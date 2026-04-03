from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, time, timedelta
from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado

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