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
    if not dados.aceitou_lgpd: raise HTTPException(status_code=403, detail="Aceite LGPD obrigatório.")
    
    dados_gov = cadsus.consultar_por_cpf(cpf)
    if not dados_gov: raise HTTPException(status_code=502, detail="CADSUS indisponível.")
    
    existente = db.query(models.Paciente).filter(models.Paciente.nr_cpf == cpf).first()
    if existente: return {"msg": "Paciente já cadastrado.", "nome": existente.nm_paciente}

    novo = models.Paciente(
        id_municipio=dados.id_municipio, id_ubs_referencia=dados.id_ubs_referencia,
        nr_cpf=cpf, nr_cns=dados_gov.cns, nm_paciente=dados_gov.nome,
        dt_nascimento=dados_gov.dataNascimento, tp_sexo="I",
        contato={"celular": dados.celular}, is_validado_sus=True,
        dt_aceite_lgpd=datetime.now(timezone.utc) 
    )
    db.add(novo); db.commit(); db.refresh(novo)
    return {"msg": "Paciente registado!", "id_paciente": novo.id_paciente}