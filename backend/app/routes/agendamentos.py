from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, time, timedelta
from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado, get_tenant_db
from fastapi import Query
from typing import List

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])

# Função auxiliar movida para cá
def somar_minutos(horario: time, minutos: int) -> time:
    data_falsa = date(2000, 1, 1)
    dt_completa = datetime.combine(data_falsa, horario) + timedelta(minutes=minutos)
    return dt_completa.time()

@router.post("/")
def realizar_agendamento(dados: schemas.NovoAgendamentoApp, db: Session = Depends(get_db)):
    # Trava de Absenteísmo
    paciente = db.query(models.Paciente).filter(models.Paciente.id_paciente == dados.id_paciente).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
        
    municipio = db.query(models.Municipio).filter(models.Municipio.id_municipio == paciente.id_municipio).first()
    if municipio and municipio.config_absenteismo:
        limite_faltas = municipio.config_absenteismo.get("faltas_limite", 3)
        faltas_cometidas = db.query(models.ItAgendaCentral).filter(
            models.ItAgendaCentral.id_paciente == dados.id_paciente,
            models.ItAgendaCentral.tp_situacao == 'F'
        ).count()
        if faltas_cometidas >= limite_faltas:
            raise HTTPException(status_code=403, detail="Bloqueio por absenteísmo.")

    # Trava de Overbooking (LOCK)
    agenda_dia = db.query(models.AgendaCentral).filter(
        models.AgendaCentral.id_escala == dados.id_escala,
        models.AgendaCentral.dt_agenda == dados.data_agendamento
    ).with_for_update().first()

    if not agenda_dia:
        agenda_dia = models.AgendaCentral(id_escala=dados.id_escala, dt_agenda=dados.data_agendamento)
        db.add(agenda_dia); db.flush() 
        
    slot_ocupado = db.query(models.ItAgendaCentral).filter(
        models.ItAgendaCentral.id_agenda == agenda_dia.id_agenda,
        models.ItAgendaCentral.hr_agenda == dados.hora_vaga,
        models.ItAgendaCentral.tp_situacao.in_(['M', 'A'])
    ).first()
    
    if slot_ocupado:
        raise HTTPException(status_code=409, detail="Horário reservado.")

    novo_slot = models.ItAgendaCentral(
        id_agenda=agenda_dia.id_agenda, hr_agenda=dados.hora_vaga,
        id_paciente=dados.id_paciente, tp_situacao='M'
    )
    db.add(novo_slot); db.commit() 
    return {"msg": "Agendamento confirmado!", "id_item": novo_slot.id_item}

@router.patch("/{id_item}/status")
def atualizar_status_recepcao(id_item: str, dados: schemas.AtualizaStatusAgendamento, db: Session = Depends(get_db), usuario = Depends(get_usuario_logado)):
    slot = db.query(models.ItAgendaCentral).filter(models.ItAgendaCentral.id_item == id_item).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
    slot.tp_situacao = dados.novo_status
    db.commit()
    return {"msg": "Status atualizado", "novo_status": slot.tp_situacao, "executor": usuario["sub"]}

@router.get("/especialidades")
def listar_especialidades(db: Session = Depends(get_db)):
    especialidades = db.query(models.Especialidade).filter(models.Especialidade.is_livre_demanda == True).all()
    return [{"id_especialidade": e.id_especialidade, "nome": e.nome} for e in especialidades]

@router.get("/minha-agenda")
def listar_agenda_medico(
    db_tenant: tuple = Depends(get_tenant_db), # <--- Nossa injeção poderosa aqui
    usuario: dict = Depends(get_usuario_logado)
):
    # Desempacota a tupla retornada pelo get_tenant_db
    db, tenant_id = db_tenant
    hoje = date.today()
    
    # Observe a segurança: Filtramos a Escala pelo Profissional logado 
    # E garantimos silenciosamente que a UBS pertence ao Tenant (Município) dele
    pacientes = db.query(models.ItAgendaCentral).join(
        models.AgendaCentral
    ).join(
        models.EscalaCentral
    ).join(
        models.UBS, models.EscalaCentral.id_ubs == models.UBS.id_ubs
    ).filter(
        models.EscalaCentral.id_profissional == usuario["id_profissional"],
        models.AgendaCentral.dt_agenda == hoje,
        models.UBS.id_municipio == tenant_id  # <--- TENANT ENFORCEMENT EM AÇÃO!
    ).all()
    
    return {
        "medico": usuario["sub"], 
        "data": hoje, 
        "total_pacientes": len(pacientes),
        "pacientes": [
            {"hora": p.hr_agenda.strftime("%H:%M"), "status": p.tp_situacao} 
            for p in pacientes
        ]
    }

# ==========================================
# FUNÇÃO UTILITÁRIA (GERADOR PYTHONICO)
# ==========================================
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
# ENDPOINT DE DISPONIBILIDADE
# ==========================================
@router.get("/disponiveis")
def listar_horarios_disponiveis(
    id_escala: str = Query(..., description="ID da Escala Central (O molde)"),
    data_consulta: date = Query(..., description="Data desejada para o agendamento"),
    db: Session = Depends(get_db)
):
    # 1. Buscar a Escala (Molde) para saber os horários e tempo de atendimento
    escala = db.query(models.EscalaCentral).filter(
        models.EscalaCentral.id_escala == id_escala
    ).first()
    
    if not escala:
        raise HTTPException(status_code=404, detail="Escala não encontrada.")

    # 👇 NOVA TRAVA SÊNIOR AQUI 👇
    if not escala.is_disponivel_app:
        raise HTTPException(
            status_code=403, 
            detail="Esta agenda é exclusiva para marcação presencial na recepção da UBS."
        )

    # 2. Gerar TODOS os slots possíveis em memória usando o nosso Generator
    todos_slots = list(gerar_slots_tempo(escala.hr_inicio, escala.hr_fim, escala.tempo_medio_min))
    
    # 3. Verificar se já existe uma agenda gerada para este dia
    agenda_dia = db.query(models.AgendaCentral).filter(
        models.AgendaCentral.id_escala == id_escala,
        models.AgendaCentral.dt_agenda == data_consulta,
        models.AgendaCentral.sn_ativo == True
    ).first()

    slots_ocupados = set() # Usamos Set pela performance O(1) na pesquisa

    if agenda_dia:
        # 4. Se a agenda existe, buscamos os slots que NÃO estão disponíveis
        # 'M' = Marcado, 'A' = Chegou/Aguardando, 'F' = Faltou
        itens_ocupados = db.query(models.ItAgendaCentral.hr_agenda).filter(
            models.ItAgendaCentral.id_agenda == agenda_dia.id_agenda,
            models.ItAgendaCentral.tp_situacao.in_(['M', 'A', 'F']) 
        ).all()
        
        # itens_ocupados retorna uma lista de tuplos, ex: [(datetime.time(8, 0),), ...]
        slots_ocupados = {item[0] for item in itens_ocupados}

    # 5. Cruzamento de dados (List Comprehension)
    # Retorna o slot apenas se ele não estiver no Set de ocupados
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

# Adicione no final de app/routes/agendamentos.py

@router.patch("/{id_item}/cancelar")
def cancelar_agendamento_paciente(
    id_item: str, 
    db: Session = Depends(get_db)
    # Nota: Em produção, aqui entraria também a validação do Token do Paciente (App)
    # para garantir que só o dono do agendamento pode cancelar.
):
    """
    Rota utilizada pelo App do Cidadão para cancelar uma marcação.
    Altera o status para 'C' (Cancelado), liberando o slot para outros pacientes.
    """
    slot = db.query(models.ItAgendaCentral).filter(
        models.ItAgendaCentral.id_item == id_item
    ).first()

    if not slot:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        
    if slot.tp_situacao == 'C':
        raise HTTPException(status_code=400, detail="Este agendamento já foi cancelado.")
        
    if slot.tp_situacao == 'A' or slot.tp_situacao == 'F':
        raise HTTPException(
            status_code=400, 
            detail="Não é possível cancelar um agendamento que já foi concluído ou faturado como falta."
        )

    # Aplica o status de cancelamento
    slot.tp_situacao = 'C'
    db.commit()

    return {
        "msg": "Agendamento cancelado com sucesso. A vaga foi devolvida à UBS.", 
        "novo_status": slot.tp_situacao
    }