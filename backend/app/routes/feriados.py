from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, delete
from datetime import date
import uuid

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado
from ..services.feriados_service import consultar_feriados_nacionais

router = APIRouter(prefix="/feriados", tags=["Gestão de Feriados"])

@router.get("/", response_model=list[schemas.FeriadoResponse])
async def listar_todos_feriados(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Lista todos os feriados registrados (API Nacional + Banco Municipal).
    """
    tenant_id = usuario.get("tenant_id")
    hoje = date.today()
    
    # 1. Busca Feriados Municipais no Banco
    stmt = select(models.Feriado).where(models.Feriado.id_municipio == tenant_id).order_by(models.Feriado.data)
    result = await db.execute(stmt)
    municipais = result.scalars().all()
    
    # 2. Busca Feriados Nacionais (BrasilAPI) para o ano atual
    try:
        nacionais_raw = await consultar_feriados_nacionais(hoje.year)
    except Exception:
        nacionais_raw = []

    # 3. Formata os nacionais para o schema comum
    nacionais = [
        schemas.FeriadoResponse(
            id_feriado=None, # Indica que não é deletável/editável no banco
            data=date.fromisoformat(f["date"]),
            descricao=f["name"],
            tipo="nacional",
            dt_cadastro=None
        )
        for f in nacionais_raw
    ]

    # 4. Une as listas e ordena por data
    total = list(municipais) + nacionais
    total.sort(key=lambda x: x.data)
    
    return total

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.FeriadoResponse)
async def criar_feriado(
    dados: schemas.FeriadoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Cadastra um novo feriado para o município (Ex: Aniversário da Cidade).
    """
    tenant_id = usuario.get("tenant_id")
    
    # Verificar se já existe feriado nesta data para este município
    stmt = select(models.Feriado).where(
        and_(
            models.Feriado.id_municipio == tenant_id,
            models.Feriado.data == dados.data
        )
    )
    existente = (await db.execute(stmt)).scalar_one_or_none()
    if existente:
        raise HTTPException(status_code=400, detail="Já existe um feriado cadastrado para esta data.")

    novo = models.Feriado(
        id_municipio=tenant_id,
        data=dados.data,
        descricao=dados.descricao,
        tipo=dados.tipo
    )
    db.add(novo)
    await db.commit()
    await db.refresh(novo)
    return novo

@router.delete("/{id_feriado}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_feriado(
    id_feriado: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Remove um feriado municipal.
    """
    tenant_id = usuario.get("tenant_id")
    stmt = delete(models.Feriado).where(
        and_(
            models.Feriado.id_feriado == id_feriado,
            models.Feriado.id_municipio == tenant_id
        )
    )
    result = await db.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Feriado não encontrado.")
    await db.commit()

@router.get("/verificar", tags=["Utilitários"])
async def verificar_se_e_feriado(
    data_consulta: date,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Verifica se uma data específica é feriado (Nacional via API ou Municipal via Banco).
    """
    tenant_id = usuario.get("tenant_id")
    
    # 1. Verifica no Banco de Dados do Município
    stmt = select(models.Feriado).where(
        and_(
            models.Feriado.id_municipio == tenant_id,
            models.Feriado.data == data_consulta
        )
    )
    municipal = (await db.execute(stmt)).scalar_one_or_none()
    if municipal:
        return {"feriado": True, "nome": municipal.descricao, "tipo": municipal.tipo}

    # 2. Verifica via API Nacional (BrasilAPI)
    feriados_nacionais = await consultar_feriados_nacionais(data_consulta.year)
    data_str = data_consulta.isoformat()
    nacional = next((f for f in feriados_nacionais if f["date"] == data_str), None)
    
    if nacional:
        return {"feriado": True, "nome": nacional["name"], "tipo": "nacional"}

    return {"feriado": False}