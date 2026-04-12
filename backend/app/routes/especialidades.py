from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from pydantic import BaseModel, Field

from ..database.session import get_db
from ..database import models
from ..core.security import get_usuario_logado

router = APIRouter(prefix="/especialidades", tags=["Especialidades"])

class EspecialidadeCreate(BaseModel):
    nome: str = Field(..., min_length=2, max_length=100)
    is_livre_demanda: bool = Field(default=True)

@router.get("/")
async def listar_especialidades(db: AsyncSession = Depends(get_db)):
    """Lista todas as especialidades cadastradas no sistema."""
    stmt = select(models.Especialidade)
    result = await db.execute(stmt)
    especialidades = result.scalars().all()
    
    return [
        {"id_especialidade": str(e.id_especialidade), "nome": e.nome, "is_livre_demanda": e.is_livre_demanda}
        for e in especialidades
    ]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def criar_especialidade(
    dados: EspecialidadeCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Cria uma nova especialidade. Requer autenticação de admin_master.
    """
    # Verificar se já existe especialidade com o mesmo nome
    stmt = select(models.Especialidade).where(models.Especialidade.nome == dados.nome)
    existente = (await db.execute(stmt)).scalar_one_or_none()
    
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Especialidade '{dados.nome}' já está cadastrada no sistema."
        )
    
    nova = models.Especialidade(nome=dados.nome, is_livre_demanda=dados.is_livre_demanda)
    db.add(nova)
    
    try:
        await db.commit()
        await db.refresh(nova)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar especialidade: {str(e)}")
    
    return {
        "msg": "Especialidade cadastrada com sucesso!",
        "id_especialidade": str(nova.id_especialidade),
        "nome": nova.nome,
        "is_livre_demanda": nova.is_livre_demanda
    }

@router.delete("/{id_especialidade}", status_code=status.HTTP_200_OK)
async def remover_especialidade(
    id_especialidade: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """Remove uma especialidade (apenas se não houver escalas vinculadas)."""
    import uuid as uuid_lib
    try:
        uid = uuid_lib.UUID(id_especialidade)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido.")
    
    stmt = select(models.Especialidade).where(models.Especialidade.id_especialidade == uid)
    esp = (await db.execute(stmt)).scalar_one_or_none()
    
    if not esp:
        raise HTTPException(status_code=404, detail="Especialidade não encontrada.")
    
    # Verificar se há escalas usando essa especialidade
    stmt_escalas = select(models.EscalaCentral).where(models.EscalaCentral.id_especialidade == uid)
    em_uso = (await db.execute(stmt_escalas)).first()
    
    if em_uso:
        raise HTTPException(
            status_code=400,
            detail="Não é possível remover esta especialidade pois existem escalas vinculadas a ela."
        )
    
    await db.delete(esp)
    await db.commit()
    
    return {"msg": f"Especialidade '{esp.nome}' removida com sucesso."}
