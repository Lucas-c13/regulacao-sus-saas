from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, date, time, timedelta
from typing import List

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado

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

@router.post("/")
async def realizar_agendamento(dados: schemas.NovoAgendamentoApp, db: AsyncSession = Depends(get_db)):
    # 1. Trava de Absenteísmo
    stmt_paciente = select(models.Paciente).filter_by(id_paciente=dados.id_paciente)
    paciente = (await db.execute(stmt_paciente)).scalar_one_or_none()
    
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
        
    stmt_municipio = select(models.Municipio).filter_by(id_municipio=paciente.id_municipio)
    municipio = (await db.execute(stmt_municipio)).scalar_one_or_none()
    
    if municipio and municipio.config_absenteismo:
        limite_faltas = municipio.config_absenteismo.get("faltas_limite", 3)
        
        # Contagem de faltas usando func.count para otimizar a query
        stmt_faltas = select(func.count(models.ItAgendaCentral.id_item)).filter(
            models.ItAgendaCentral.id_paciente == dados.id_paciente,
            models.ItAgendaCentral.tp_situacao == 'F'
        )
        faltas_cometidas = (await db.execute(stmt_faltas)).scalar()
        
        if faltas_cometidas >= limite_faltas:
            raise HTTPException(status_code=403, detail="Bloqueio por absenteísmo.")

    # 2. Iniciar Transação e Trava de Overbooking (Pessimistic Lock)
    async with db.begin():
        stmt_agenda = select(models.AgendaCentral).filter(
            models.AgendaCentral.id_escala == dados.id_escala,
            models.AgendaCentral.dt_agenda == dados.data_agendamento
        ).with_for_update() # O Lock acontece aqui!
        
        agenda_dia = (await db.execute(stmt_agenda)).scalar_one_or_none()

        # Se a agenda do dia não existe, cria o "molde"
        if not agenda_dia:
            agenda_dia = models.AgendaCentral(id_escala=dados.id_escala, dt_agenda=dados.data_agendamento)
            db.add(agenda_dia)
            await db.flush() # Flush envia para o banco para gerar o ID, mas não commita ainda
            
        # Verifica se o slot exato já foi ocupado (Evita Race Condition)
        stmt_slot = select(models.ItAgendaCentral).filter(
            models.ItAgendaCentral.id_agenda == agenda_dia.id_agenda,
            models.ItAgendaCentral.hr_agenda == dados.hora_vaga,
            models.ItAgendaCentral.tp_situacao.in_(['M', 'A'])
        )
        slot_ocupado = (await db.execute(stmt_slot)).first()
        
        if slot_ocupado:
            raise HTTPException(status_code=409, detail="Horário reservado por outro cidadão neste momento.")

        # 3. Confirma o Agendamento
        novo_slot = models.ItAgendaCentral(
            id_agenda=agenda_dia.id_agenda, 
            hr_agenda=dados.hora_vaga,
            id_paciente=dados.id_paciente, 
            tp_situacao='M'
        )
        db.add(novo_slot)
        
    # O commit é automático ao sair do bloco `async with db.begin()`
    return {"msg": "Agendamento confirmado!", "id_item": novo_slot.id_item}


@router.patch("/{id_item}/status")
async def atualizar_status_recepcao(id_item: str, dados: schemas.AtualizaStatusAgendamento, db: AsyncSession = Depends(get_db), usuario = Depends(get_usuario_logado)):
    stmt = select(models.ItAgendaCentral).filter_by(id_item=id_item)
    slot = (await db.execute(stmt)).scalar_one_or_none()
    
    if not slot:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        
    slot.tp_situacao = dados.novo_status
    await db.commit()
    
    return {"msg": "Status atualizado", "novo_status": slot.tp_situacao, "executor": usuario["sub"]}


@router.get("/especialidades")
async def listar_especialidades(db: AsyncSession = Depends(get_db)):
    stmt = select(models.Especialidade).filter_by(is_livre_demanda=True)
    # scalars().all() extrai os objetos da tupla do SQLAlchemy
    especialidades = (await db.execute(stmt)).scalars().all() 
    return [{"id_especialidade": e.id_especialidade, "nome": e.nome} for e in especialidades]


@router.get("/minha-agenda")
async def listar_agenda_medico(
    id_ubs: str, 
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    hoje = datetime.now().date()

    # JOIN no novo formato do SQLAlchemy 2.0
    stmt = select(models.ItAgendaCentral).join(
        models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda
    ).join(
        models.EscalaCentral, models.AgendaCentral.id_escala == models.EscalaCentral.id_escala
    ).filter(
        models.EscalaCentral.id_profissional == usuario["id_profissional"],
        models.EscalaCentral.id_ubs == id_ubs, 
        models.AgendaCentral.dt_agenda == hoje,
        models.AgendaCentral.sn_ativo == True
    ).order_by(models.ItAgendaCentral.hr_agenda)

    pacientes = (await db.execute(stmt)).scalars().all()

    return {
        "medico": usuario["sub"], 
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
    db: AsyncSession = Depends(get_db)
):
    # 1. Buscar a Escala (Molde)
    stmt_escala = select(models.EscalaCentral).filter_by(id_escala=id_escala)
    escala = (await db.execute(stmt_escala)).scalar_one_or_none()
    
    if not escala:
        raise HTTPException(status_code=404, detail="Escala não encontrada.")

    # Trava Sênior
    if not escala.is_disponivel_app:
        raise HTTPException(
            status_code=403, 
            detail="Esta agenda é exclusiva para marcação presencial na recepção da UBS."
        )

    # 2. Gerar TODOS os slots em memória
    todos_slots = list(gerar_slots_tempo(escala.hr_inicio, escala.hr_fim, escala.tempo_medio_min))
    
    # 3. Verificar se já existe uma agenda gerada para este dia
    stmt_agenda = select(models.AgendaCentral).filter(
        models.AgendaCentral.id_escala == id_escala,
        models.AgendaCentral.dt_agenda == data_consulta,
        models.AgendaCentral.sn_ativo == True
    )
    agenda_dia = (await db.execute(stmt_agenda)).scalar_one_or_none()

    slots_ocupados = set() 

    if agenda_dia:
        # Buscamos apenas a hr_agenda para economizar memória (Query Otimizada)
        stmt_itens = select(models.ItAgendaCentral.hr_agenda).filter(
            models.ItAgendaCentral.id_agenda == agenda_dia.id_agenda,
            models.ItAgendaCentral.tp_situacao.in_(['M', 'A', 'F']) 
        )
        itens_ocupados = (await db.execute(stmt_itens)).scalars().all()
        
        # O scalars().all() já retorna a lista limpa de datetime.time
        slots_ocupados = set(itens_ocupados)

    # 4. Cruzamento de dados 
    slots_disponiveis = [
        slot.strftime("%H:%M") for slot in todos_slots if slot not in slots_ocupados
    ]

    return {
        "id_escala": id_escala,
        "data_consulta": data_consulta,
        "tempo_atendimento_min": escala.tempo_medio_min,
        "total_vagas_livres": len(slots_disponiveis),
        "horarios_disponiveis": slots_disponiveis
    }


@router.patch("/{id_item}/cancelar")
async def cancelar_agendamento_paciente(
    id_item: str, 
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.ItAgendaCentral).filter_by(id_item=id_item)
    slot = (await db.execute(stmt)).scalar_one_or_none()

    if not slot:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        
    if slot.tp_situacao == 'C':
        raise HTTPException(status_code=400, detail="Este agendamento já foi cancelado.")
        
    if slot.tp_situacao in ['A', 'F']:
        raise HTTPException(
            status_code=400, 
            detail="Não é possível cancelar um agendamento que já foi concluído ou faturado como falta."
        )

    # Aplica o status de cancelamento
    slot.tp_situacao = 'C'
    await db.commit()

    return {
        "msg": "Agendamento cancelado com sucesso. A vaga foi devolvida à UBS.", 
        "novo_status": slot.tp_situacao
    }