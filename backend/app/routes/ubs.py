from fastapi import APIRouter, Depends, HTTPException
from fastapi_cache.decorator import cache
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..database.session import get_db
from ..database import models
from ..core.security import get_usuario_logado

router = APIRouter(prefix="/ubs", tags=["Unidades de Saúde (Tenant)"])

@router.get("/")
@cache(expire=3600) # Mantém em cache no Redis durante 1 hora
async def listar_ubs(db: AsyncSession = Depends(get_db)):
    # Usando o nome correto do modelo: models.UBS
    stmt = select(models.UBS)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/minhas-ubs")
async def listar_minhas_ubs(
    db: AsyncSession = Depends(get_db), 
    usuario: dict = Depends(get_usuario_logado)
):
    id_profissional = usuario["id_profissional"]

    # Refatorado para o padrão Assíncrono do SQLAlchemy 2.0 (Alta Performance)
    stmt = select(models.UBS).join(
        models.UbsProfissional, models.UBS.id_ubs == models.UbsProfissional.id_ubs
    ).filter(
        models.UbsProfissional.id_profissional == id_profissional
    )

    result = await db.execute(stmt)
    resultados = result.scalars().all()

    if not resultados:
        raise HTTPException(status_code=404, detail="Profissional não está vinculado a nenhuma UBS.")

    return [
        {"id_ubs": str(ubs.id_ubs), "nome_ubs": ubs.nome}
        for ubs in resultados
    ]