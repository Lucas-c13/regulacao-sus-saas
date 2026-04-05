from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_

from ..database.session import get_db
from ..database import models
from ..core.security import get_usuario_logado

router = APIRouter(prefix="/ubs", tags=["Unidades de Saúde (Tenant)"])

@router.get("/")
async def listar_ubs(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Lista todas as UBSs pertencentes EXCLUSIVAMENTE ao município do utilizador logado.
    O cache foi removido desta camada para evitar Data Leak entre Tenants.
    """
    tenant_id = usuario.get("tenant_id")
    
    # Escudo Multi-Tenant (Tenant Enforcement)
    stmt = select(models.UBS).where(models.UBS.id_municipio == tenant_id)
    
    result = await db.execute(stmt)
    ubs_lista = result.scalars().all()
    
    return [
        {"id_ubs": str(ubs.id_ubs), "nome_ubs": ubs.nome, "cnes": ubs.cnes}
        for ubs in ubs_lista
    ]


@router.get("/minhas-ubs")
async def listar_minhas_ubs(
    db: AsyncSession = Depends(get_db), 
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Lista apenas as UBSs nas quais o profissional de saúde possui vínculo ativo.
    """
    id_profissional = usuario.get("id_profissional")
    tenant_id = usuario.get("tenant_id")

    # Refatorado para o padrão Assíncrono com Defense-in-Depth (Dupla checagem de segurança)
    stmt = select(models.UBS).join(
        models.UbsProfissional, models.UBS.id_ubs == models.UbsProfissional.id_ubs
    ).where(
        and_(
            models.UbsProfissional.id_profissional == id_profissional,
            models.UBS.id_municipio == tenant_id # Garante que não há injeção cruzada
        )
    )

    result = await db.execute(stmt)
    resultados = result.scalars().all()

    if not resultados:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Não está vinculado a nenhuma UBS neste município."
        )

    return [
        {"id_ubs": str(ubs.id_ubs), "nome_ubs": ubs.nome}
        for ubs in resultados
    ]