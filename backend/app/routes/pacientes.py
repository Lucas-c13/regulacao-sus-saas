from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..services.cadsus_service import CADSUSService

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])
cadsus = CADSUSService()

@router.post("/validar-cadsus/{cpf}")
def validar_e_cadastrar_paciente(cpf: str, dados: schemas.CadastroPacienteApp, db: Session = Depends(get_db)):
    if not dados.aceitou_lgpd:
        raise HTTPException(status_code=403, detail="Aceite da LGPD obrigatório.")
    
    dados_gov = cadsus.consultar_por_cpf(cpf)
    if not dados_gov:
        raise HTTPException(status_code=502, detail="CADSUS indisponível.")
    
    # ... (Restante da lógica de cadastro que você já tem no main.py) ...