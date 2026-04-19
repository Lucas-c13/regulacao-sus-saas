import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database.session import get_db
from app.database import models
from app.schemas import schemas
from app.core.security import require_admin_master, get_usuario_logado # Imports adicionados

router = APIRouter(prefix="/municipios", tags=["Municípios (Nível 1 - Master)"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def criar_municipio(
    dados: schemas.MunicipioCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(require_admin_master) 
):
    """Cadastro exclusivo para Admin Master (Nível 1)"""
    stmt = select(models.Municipio).where(models.Municipio.ibge == dados.ibge)
    existente = (await db.execute(stmt)).scalar_one_or_none()
    
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Município já cadastrado com este código IBGE."
        )

    # Criando o registro mapeando tanto o JSONB quanto as novas colunas flat
    novo_municipio = models.Municipio(
        ibge=dados.ibge,
        nome=dados.nome,
        nome_exibicao=dados.nome, # Default inicial
        cor_primaria=dados.tema_visual.color_primary,
        faltas_limite=dados.config_absenteismo.faltas_limite,
        config_absenteismo=dados.config_absenteismo.model_dump(),
        tema_visual=dados.tema_visual.model_dump()
    )
    
    db.add(novo_municipio)
    await db.commit()
    await db.refresh(novo_municipio)

    return {"msg": "Tenant criado!", "id_municipio": str(novo_municipio.id_municipio)}


@router.put("/{id_municipio}", response_model=schemas.MunicipioResponse)
async def atualizar_configuracoes_municipio(
    id_municipio: uuid.UUID,
    dados: schemas.MunicipioResponse,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Atualização de Configurações (Cores, Limites, Nome Exibição)
    Permitido para Master ou Gestor do próprio Município.
    """
    # 1. Segurança: Só altera o próprio tenant (ou se for Master)
    is_master = usuario.get("role") == "admin_master"
    if not is_master and str(id_municipio) != usuario.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Acesso negado às configurações deste município.")

    municipio = await db.get(models.Municipio, id_municipio)
    if not municipio:
        raise HTTPException(status_code=404, detail="Município não encontrado.")

    # 2. Atualização das colunas flat (usadas na UI e na Trava)
    municipio.nome_exibicao = dados.nome_exibicao
    municipio.cor_primaria = dados.cor_primaria
    municipio.faltas_limite = dados.faltas_limite
    municipio.slug = dados.slug
    municipio.logo_url = dados.logo_url

    # 3. Sincroniza os dicionários JSONB (opcional, mas bom para manter legado)
    municipio.tema_visual = {"color_primary": dados.cor_primaria}
    municipio.config_absenteismo = {"faltas_limite": dados.faltas_limite}

    await db.commit()
    await db.refresh(municipio)
    return municipio