from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database.session import get_db
from ..database import models
from ..core.security import get_usuario_logado

router = APIRouter(prefix="/ubs", tags=["Unidades de Saúde (Tenant)"])

@router.get("/minhas-ubs")
def listar_minhas_ubs(
    db: Session = Depends(get_db), 
    usuario: dict = Depends(get_usuario_logado)
):
    id_profissional = usuario["id_profissional"]

    # Usando models.UBS (maiúsculo) e removendo o sn_ativo que não existe nesta tabela
    resultados = db.query(models.UBS).join(
        models.UbsProfissional, models.UBS.id_ubs == models.UbsProfissional.id_ubs
    ).filter(
        models.UbsProfissional.id_profissional == id_profissional
    ).all()

    if not resultados:
        raise HTTPException(status_code=404, detail="Profissional não está vinculado a nenhuma UBS.")

    return [
        {"id_ubs": str(ubs.id_ubs), "nome_ubs": ubs.nome}
        for ubs in resultados
    ]