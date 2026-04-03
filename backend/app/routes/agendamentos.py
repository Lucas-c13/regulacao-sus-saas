from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, time
from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])

def somar_minutos(horario: time, minutos: int) -> time:
    data_falsa = date(2000, 1, 1)
    dt_completa = datetime.combine(data_falsa, horario) + timedelta(minutes=minutos)
    return dt_completa.time()

@router.post("/")
def realizar_agendamento(dados: schemas.NovoAgendamentoApp, db: Session = Depends(get_db)):
    # ... (Cole aqui a sua lógica de Trava de Absenteísmo e Overbooking do main.py antigo) ...
    pass

@router.get("/minha-agenda")
def listar_agenda_medico(db: Session = Depends(get_db), usuario = Depends(get_usuario_logado)):
    # ... (Cole aqui a lógica da rota /agenda-medica/hoje) ...
    pass