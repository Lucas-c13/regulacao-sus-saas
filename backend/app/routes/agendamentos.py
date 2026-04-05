from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, update, and_
from datetime import datetime, date, time, timedelta
from typing import List
from zoneinfo import ZoneInfo

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado

import json
from ..core.middlewares import redis_client

fuso_br = ZoneInfo('America/Sao_Paulo')

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])

# ==========================================
# FUNÇÕES AUXILIARES
# ==========================================
def somar_minutos(horario: time, minutos: int) -> time:
    data_falsa = date(2000, 1, 1)
    dt_completa = datetime.combine(data_falsa, horario) + timedelta(minutes=minutos)
    return dt_completa.time()

def gerar_slots_tempo(hr_inicio: time, hr_fim: time, intervalo_min: int):
    """
    Gerador que fatia o tempo de forma eficiente em memória.
    Usa uma data fictícia apenas para permitir a soma de timedelta.
    """
    data_base = date(2000, 1, 1) 
    atual = datetime.combine(data_base, hr_inicio)
    fim = datetime.combine(data_base, hr_fim)
    
    while atual + timedelta(minutes=intervalo_min) <= fim:
        yield atual.time()
        atual += timedelta(minutes=intervalo_min)


# ==========================================
# ROTAS
# ==========================================

@router.post("/", status_code=status.HTTP_201_CREATED)
async def realizar_agendamento(
    dados: schemas.NovoAgendamentoApp, 
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado) # Injeção do utilizador logado para Tenant Enforcement
):
    tenant_id = usuario.get("tenant_id")

    # 1. Validação de Tenant e Paciente
    stmt_paciente = select(models.Paciente).filter(
        and_(
            models.Paciente.id_paciente == dados.id_paciente,
            models.Paciente.id_municipio == tenant_id # Isolamento de Tenant
        )
    )
    paciente = (await db.execute(stmt_paciente)).scalar_one_or_none()
    
    if not paciente:
        raise HTTPException(status_code=404, detail="Utente não encontrado no seu município.")
        
    stmt_municipio = select(models.Municipio).filter_by(id_municipio=tenant_id)
    municipio = (await db.execute(stmt_municipio)).scalar_one_or_none()
    
    # 2. Trava de Absenteísmo com Janela de Tempo
    if municipio and municipio.config_absenteismo:
        limite_faltas = municipio.config_absenteismo.get("faltas_limite", 3)
        dias_janela = municipio.config_absenteismo.get("dias_janela", 30)
        data_corte = datetime.now(fuso_br).date() - timedelta(days=dias_janela)
        
        # Contagem de faltas estritamente dentro da janela de tempo definida (ex: últimos 30 dias)
        stmt_faltas = select(func.count(models.ItAgendaCentral.id_item)).join(
            models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda
        ).filter(
            models.ItAgendaCentral.id_paciente == dados.id_paciente,
            models.ItAgendaCentral.tp_situacao == 'F',
            models.AgendaCentral.dt_agenda >= data_corte
        )
        faltas_cometidas = (await db.execute(stmt_faltas)).scalar()
        
        if faltas_cometidas >= limite_faltas:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Bloqueio por absenteísmo: O utente excedeu o limite de {limite_faltas} faltas nos últimos {dias_janela} dias."
            )

    # 3. Iniciar Transação e Trava de Overbooking (Pessimistic Lock)
    async with db.begin():
        # Garantir que a escala pertence ao município do utilizador logado
        stmt_escala = select(models.EscalaCentral).filter(
            models.EscalaCentral.id_escala == dados.id_escala,
            models.EscalaCentral.id_municipio == tenant_id
        )
        escala_valida = (await db.execute(stmt_escala)).scalar_one_or_none()
        if not escala_valida:
            raise HTTPException(status_code=403, detail="Acesso negado a esta escala.")

        stmt_agenda = select(models.AgendaCentral).filter(
            models.AgendaCentral.id_escala == dados.id_escala,
            models.AgendaCentral.dt_agenda == dados.data_agendamento
        ).with_for_update() # Lock de registo ativo
        
        agenda_dia = (await db.execute(stmt_agenda)).scalar_one_or_none()

        # Se a agenda do dia não existe, cria o "molde"
        if not agenda_dia:
            agenda_dia = models.AgendaCentral(
                id_escala=dados.id_escala, 
                dt_agenda=dados.data_agendamento,
                id_municipio=tenant_id
            )
            db.add(agenda_dia)
            await db.flush()
            
        # Verifica se o slot exato já foi ocupado (Evita Race Condition)
        stmt_slot = select(models.ItAgendaCentral).filter(
            models.ItAgendaCentral.id_agenda == agenda_dia.id_agenda,
            models.ItAgendaCentral.hr_agenda == dados.hora_vaga,
            models.ItAgendaCentral.tp_situacao.in_(['M', 'A'])
        )
        slot_ocupado = (await db.execute(stmt_slot)).first()
        
        if slot_ocupado:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail="Horário já reservado por outro cidadão."
            )

        # 4. Confirma o Agendamento
        novo_slot = models.ItAgendaCentral(
            id_agenda=agenda_dia.id_agenda, 
            hr_agenda=dados.hora_vaga,
            id_paciente=dados.id_paciente, 
            tp_situacao='M'
        )
        db.add(novo_slot)
        # --- 5. INVALIDAÇÃO DE CACHE ---
    # Apaga o cache para forçar a API a ir ao banco na próxima leitura
    try:
        cache_key = f"vagas:{tenant_id}:{dados.id_escala}:{dados.data_agendamento}"
        await redis_client.delete(cache_key)
    except Exception:
        pass

    return {"msg": "Agendamento confirmado!", "id_item": str(novo_slot.id_item)}
        


@router.patch("/{id_item}/status")
async def atualizar_status_recepcao(
    id_item: str, 
    dados: schemas.AtualizaStatusAgendamento, 
    db: AsyncSession = Depends(get_db), 
    usuario: dict = Depends(get_usuario_logado)
):
    # Tenant Enforcement cruzando com a AgendaCentral
    stmt = select(models.ItAgendaCentral).join(
        models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda
    ).filter(
        models.ItAgendaCentral.id_item == id_item,
        models.AgendaCentral.id_municipio == usuario.get("tenant_id")
    )
    
    slot = (await db.execute(stmt)).scalar_one_or_none()
    
    if not slot:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado ou sem permissão de acesso.")
        
    slot.tp_situacao = dados.novo_status
    await db.commit()
    
    return {"msg": "Status atualizado", "novo_status": slot.tp_situacao, "executor": usuario.get("sub")}


@router.get("/especialidades")
async def listar_especialidades(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    # Asumindo que as especialidades são globais, caso sejam por município, adicione o filtro:
    # .filter_by(is_livre_demanda=True, id_municipio=usuario.get("tenant_id"))
    stmt = select(models.Especialidade).filter_by(is_livre_demanda=True)
    especialidades = (await db.execute(stmt)).scalars().all() 
    return [{"id_especialidade": e.id_especialidade, "nome": e.nome} for e in especialidades]


@router.get("/minha-agenda")
async def listar_agenda_medico(
    id_ubs: str, 
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    hoje = datetime.now(fuso_br).date()

    stmt = select(models.ItAgendaCentral).join(
        models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda
    ).join(
        models.EscalaCentral, models.AgendaCentral.id_escala == models.EscalaCentral.id_escala
    ).filter(
        models.EscalaCentral.id_profissional == usuario.get("id_profissional"),
        models.EscalaCentral.id_ubs == id_ubs,
        models.EscalaCentral.id_municipio == usuario.get("tenant_id"), # Segurança multi-tenant
        models.AgendaCentral.dt_agenda == hoje,
        models.AgendaCentral.sn_ativo == True
    ).order_by(models.ItAgendaCentral.hr_agenda)

    pacientes = (await db.execute(stmt)).scalars().all()

    return {
        "medico": usuario.get("sub"), 
        "data": hoje, 
        "total_pacientes": len(pacientes),
        "pacientes": [
            {
                "id_item": str(p.id_item),
                "hora": p.hr_agenda.strftime("%H:%M"), 
                "status": p.tp_situacao or 'M'
            } 
            for p in pacientes
        ]
    }


@router.get("/disponiveis")
async def listar_horarios_disponiveis(
    id_escala: str = Query(..., description="ID da Escala Central (O molde)"),
    data_consulta: date = Query(..., description="Data desejada para o agendamento"),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    tenant_id = usuario.get("tenant_id")
    
    # --- 1. TENTAR LER DO CACHE (REDIS) ---
    # Chave única para este município, escala e dia
    cache_key = f"vagas:{tenant_id}:{id_escala}:{data_consulta}"
    
    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            # Resposta em < 1ms, o PostgreSQL nem chega a ser incomodado
            return json.loads(cached_data)
    except Exception:
        pass # Se o Redis falhar por algum motivo, ignoramos e vamos ao banco

    # --- 2. LÓGICA ORIGINAL DO POSTGRESQL ---
    stmt_escala = select(models.EscalaCentral).filter_by(
        id_escala=id_escala, id_municipio=tenant_id
    )
    escala = (await db.execute(stmt_escala)).scalar_one_or_none()
    
    if not escala:
        raise HTTPException(status_code=404, detail="Escala não encontrada.")
    if not escala.is_disponivel_app:
        raise HTTPException(status_code=403, detail="Agenda exclusiva para marcação presencial.")

    todos_slots = list(gerar_slots_tempo(escala.hr_inicio, escala.hr_fim, escala.tempo_medio_min))
    
    stmt_agenda = select(models.AgendaCentral).filter(
        models.AgendaCentral.id_escala == id_escala,
        models.AgendaCentral.dt_agenda == data_consulta,
        models.AgendaCentral.sn_ativo == True
    )
    agenda_dia = (await db.execute(stmt_agenda)).scalar_one_or_none()

    slots_ocupados = set() 
    if agenda_dia:
        stmt_itens = select(models.ItAgendaCentral.hr_agenda).filter(
            models.ItAgendaCentral.id_agenda == agenda_dia.id_agenda,
            models.ItAgendaCentral.tp_situacao.in_(['M', 'A', 'F']) 
        )
        itens_ocupados = (await db.execute(stmt_itens)).scalars().all()
        slots_ocupados = set(itens_ocupados)

    slots_disponiveis = [
        slot.strftime("%H:%M") for slot in todos_slots if slot not in slots_ocupados
    ]

    resultado = {
        "id_escala": id_escala,
        "data_consulta": data_consulta.isoformat(), # Convertido para string para o JSON
        "tempo_atendimento_min": escala.tempo_medio_min,
        "total_vagas_livres": len(slots_disponiveis),
        "horarios_disponiveis": slots_disponiveis
    }

    # --- 3. GRAVAR NO CACHE ---
    # Guarda o cálculo pesado no Redis por 60 segundos
    try:
        await redis_client.setex(cache_key, 60, json.dumps(resultado))
        print("🐢 [CACHE MISS] Consulta pesada no PostgreSQL. Guardando no Redis...")
    except Exception:
        pass 

    return resultado


@router.patch("/{id_item}/cancelar")
async def cancelar_agendamento_paciente(
    id_item: str, db: AsyncSession = Depends(get_db), usuario: dict = Depends(get_usuario_logado)
):
    tenant_id = usuario.get("tenant_id")
    
    # Seleciona o Slot E a Agenda para podermos limpar o cache correto
    stmt = select(models.ItAgendaCentral, models.AgendaCentral).join(
        models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda
    ).filter(
        models.ItAgendaCentral.id_item == id_item,
        models.AgendaCentral.id_municipio == tenant_id
    )
    resultado = (await db.execute(stmt)).first()

    if not resultado:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        
    slot, agenda = resultado # Desempacota o tuplo retornado pelo select
        
    if slot.tp_situacao == 'C':
        raise HTTPException(status_code=400, detail="Este agendamento já foi cancelado.")
    if slot.tp_situacao in ['A', 'F']:
        raise HTTPException(status_code=400, detail="Não é possível cancelar uma consulta concluída.")

    slot.tp_situacao = 'C'
    await db.commit()

    # --- INVALIDAÇÃO DE CACHE ---
    try:
        cache_key = f"vagas:{tenant_id}:{agenda.id_escala}:{agenda.dt_agenda}"
        await redis_client.delete(cache_key)
    except Exception:
        pass

    return {
        "msg": "Agendamento cancelado com sucesso. A vaga foi devolvida à UBS.", 
        "novo_status": slot.tp_situacao
    }


@router.patch("/paciente/{id_paciente}/justificar-faltas")
async def justificar_faltas_paciente(
    id_paciente: str, 
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    # Para garantir a segurança usando update, cruzamos primeiro com uma subquery ou filtramos via modelagem direta
    # Para simplicidade e segurança, confirmamos primeiro se o utente pertence à base do município:
    stmt_paciente = select(models.Paciente.id_paciente).filter_by(
        id_paciente=id_paciente, 
        id_municipio=usuario.get("tenant_id")
    )
    if not (await db.execute(stmt_paciente)).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Acesso negado a este utente.")

    stmt_update = (
        update(models.ItAgendaCentral)
        .where(
            models.ItAgendaCentral.id_paciente == id_paciente,
            models.ItAgendaCentral.tp_situacao == 'F'
        )
        .values(tp_situacao='FJ')
    )
    
    resultado = await db.execute(stmt_update)
    await db.commit()

    if resultado.rowcount == 0:
        raise HTTPException(status_code=404, detail="O utente não possui faltas pendentes para justificar.")

    return {
        "msg": "Faltas justificadas com sucesso. O utente foi desbloqueado na App.",
        "faltas_perdoadas": resultado.rowcount,
        "rececionista": usuario.get("sub")
    }