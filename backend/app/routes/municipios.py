from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database.session import get_db
from app.database import models
from app.schemas import schemas
from app.core.security import require_admin_master

router = APIRouter(prefix="/municipios", tags=["Municípios (Nível 1 - Master)"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def criar_municipio(
    dados: schemas.MunicipioCreate,
    db: AsyncSession = Depends(get_db),
    # A injeção força que apenas alguém com token '{ "role": "admin_master" }' acesse
    usuario: dict = Depends(require_admin_master) 
):
    """
    Cadastra um novo Município (Tenant) no Banco.
    Ação Exclusiva para o Administrador Global (Nível 1).
    """
    # 1. Verifica duplicação via IBGE
    stmt = select(models.Municipio).where(models.Municipio.ibge == dados.ibge)
    result = await db.execute(stmt)
    existente = result.scalar_one_or_none()
    
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Um município com este código IBGE já encontra-se registado."
        )

    # 2. Tipagem nativa do Pydantic para os Dicionários JSONB
    novo_municipio = models.Municipio(
        ibge=dados.ibge,
        nome=dados.nome,
        config_absenteismo=dados.config_absenteismo.model_dump(),
        tema_visual=dados.tema_visual.model_dump()
    )
    
    db.add(novo_municipio)
    
    try:
        await db.commit()
        await db.refresh(novo_municipio)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Falha de gravação transacional: {str(e)}"
        )

    return {
        "msg": "Município Tenant criado com sucesso e pronto a operar!",
        "id_municipio": str(novo_municipio.id_municipio)
    }
