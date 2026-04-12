from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado, require_gestor_prefeitura, get_tenant_db
from ..services.viacep_service import consultar_cep_async

router = APIRouter(prefix="/ubs", tags=["Unidades de Saúde (Tenant)"])

@router.get("/")
async def listar_ubs(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Lista todas as UBSs pertencentes EXCLUSIVAMENTE ao município do usuário logado.
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

@router.post("/", status_code=status.HTTP_201_CREATED)
async def criar_ubs(
    dados: schemas.UbsCreate,
    # Security Middleware: Apenas Gestores
    usuario: dict = Depends(require_gestor_prefeitura),
    # Extração Forçada Tenant
    db_tenant: tuple = Depends(get_tenant_db)
):
    """
    Cadastra uma nova UBS no município.
    Ação Exclusiva para o Gestor da Prefeitura (Nível 2).
    """
    db, tenant_id = db_tenant
    
    # 1. Verifica duplicidade do CNES no Banco Nacional (ou local)
    stmt = select(models.UBS).where(models.UBS.cnes == dados.cnes)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Já existe uma UBS registada com este CNES.")

    # 2. Integração Assíncrona ViaCEP para Padronização Territorial
    try:
        dados_viacep = await consultar_cep_async(dados.cep)
        # Padroniza logradouro evitando que o usuário escreva "Rua Z" e o sistema guarde "Rua Ze"
        endereco_padronizado = f"{dados_viacep.get('logradouro')}, {dados_viacep.get('bairro')} - {dados_viacep.get('localidade')}/{dados_viacep.get('uf')}"
    except HTTPException:
        # Repassa um erro amigável ao Front-form quando o CEP não for encontrado ou não tiver 8 dígitos
        raise HTTPException(status_code=400, detail="O CEP informado é inválido ou inexistente.")

    # 3. INJEÇÃO DE TENANT (Regra de Ouro)
    # A UBS é atrelada inexoravelmente ao id_municipio do Gestor Logado.
    nova_ubs = models.UBS(
        id_municipio=tenant_id,
        nome=dados.nome,
        cnes=dados.cnes,
        cep=dados.cep,
        endereco=endereco_padronizado
    )
    
    db.add(nova_ubs)
    try:
        await db.commit()
        await db.refresh(nova_ubs)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro interno de gravação: {str(e)}")

    return {"msg": "UBS estruturada com sucesso!", "id_ubs": str(nova_ubs.id_ubs)}