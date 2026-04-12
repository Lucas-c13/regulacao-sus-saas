from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado, gerar_hash, require_gestor_prefeitura, get_tenant_db

router = APIRouter(prefix="/profissionais", tags=["Profissionais e Acessos"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def criar_profissional_ubs(
    dados: schemas.NovoProfissionalUBS,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    tenant_id = usuario.get("tenant_id")
    id_profissional_logado = usuario.get("id_profissional")

    # 1. REGRA CRÍTICA: Verificar se o usuário logado é Gestor Local DESTA UBS
    stmt_gestor = select(models.UbsProfissional).where(
        and_(
            models.UbsProfissional.id_profissional == id_profissional_logado,
            models.UbsProfissional.id_ubs == dados.id_ubs
        )
    )
    result_gestor = await db.execute(stmt_gestor)
    vinculo_gestor = result_gestor.scalar_one_or_none()

    # Validamos se o vínculo existe e se a flag is_gestor_local é verdadeira dentro do JSONB
    if not vinculo_gestor or not vinculo_gestor.permissoes or not vinculo_gestor.permissoes.get("is_gestor_local"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Acesso negado: Apenas um Gestor Local pode criar usuários para esta UBS."
        )

    # 2. Tenant Enforcement: Verificar se o CPF já existe neste Município
    stmt_existente = select(models.Profissional).where(
        and_(
            models.Profissional.cpf == dados.cpf,
            models.Profissional.id_municipio == tenant_id
        )
    )
    result_existente = await db.execute(stmt_existente)
    existente = result_existente.scalar_one_or_none()
    
    if existente:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CPF já registrado neste município.")

    # 3. Criar o novo usuário garantindo o isolamento do Tenant
    novo_prof = models.Profissional(
        id_municipio=tenant_id,
        nome=dados.nome, 
        cpf=dados.cpf,
        senha_hash=gerar_hash(dados.senha),
        sn_ativo=True
    )
    db.add(novo_prof)
    
    # O flush envia o comando para o banco (gerando o UUID) sem fazer o commit final
    await db.flush() 

    # 4. Vincular o novo usuário ESTRITAMENTE à mesma UBS solicitada
    novo_vinculo = models.UbsProfissional(
        id_ubs=dados.id_ubs,
        id_profissional=novo_prof.id_profissional,
        # O novo usuário nasce com permissões restritas (Nível 3 comum)
        permissoes={"is_gestor_local": False, "can_create_escala": False} 
    )
    db.add(novo_vinculo)
    
    # Finaliza a transação gravando o Profissional e o Vínculo ao mesmo tempo
    try:
        await db.commit()
        await db.refresh(novo_prof)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro interno ao criar usuário: {str(e)}")

    return {
        "msg": "Profissional criado e vinculado com sucesso!", 
        "id_profissional": str(novo_prof.id_profissional)
    }

@router.post("/gestor-local", status_code=status.HTTP_201_CREATED)
async def criar_gestor_local(
    dados: schemas.GestorLocalCreate,
    usuario: dict = Depends(require_gestor_prefeitura),
    db_tenant: tuple = Depends(get_tenant_db)
):
    """
    Cria um usuário Nível 3 já delegado como Gestor Local de uma determinada UBS.
    Exclusivo para Nível 2 (Gestor da Prefeitura).
    """
    db, tenant_id = db_tenant

    # 1. Validação Crítica de Limites: A UBS pertence a este município?
    stmt_ubs = select(models.UBS).where(
        and_(
            models.UBS.id_ubs == dados.id_ubs,
            models.UBS.id_municipio == tenant_id
        )
    )
    result_ubs = await db.execute(stmt_ubs)
    ubs_valida = result_ubs.scalar_one_or_none()
    
    if not ubs_valida:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operação ilegal: A UBS informada não pertence ao seu município."
        )
        
    # 2. Prevenir duplicação de CPF por Município
    stmt_existente = select(models.Profissional).where(
        and_(
            models.Profissional.cpf == dados.cpf,
            models.Profissional.id_municipio == tenant_id
        )
    )
    if (await db.execute(stmt_existente)).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="CPF já possui vínculo ativo neste município.")

    # 3. Criação Isolada do Profissional
    novo_gestor = models.Profissional(
        id_municipio=tenant_id,
        nome=dados.nome,
        cpf=dados.cpf,
        senha_hash=gerar_hash(dados.senha),
        sn_ativo=True
    )
    db.add(novo_gestor)
    await db.flush() # Gerar UUID antes do commit

    # 4. JSONB Magic: O Profissional ganha o anel "is_gestor_local" para esta UBS apenas.
    novo_vinculo = models.UbsProfissional(
        id_ubs=dados.id_ubs,
        id_profissional=novo_gestor.id_profissional,
        permissoes={"is_gestor_local": True, "can_create_escala": True}
    )
    db.add(novo_vinculo)
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Tratamento abortado. Erro ao persistir dados.")

    return {
        "msg": "Novo Gestor Local estabelecido com sucesso!", 
        "id_profissional": str(novo_gestor.id_profissional)
    }

@router.get("/municipio", status_code=status.HTTP_200_OK)
async def listar_profissionais_municipio(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Retorna todos os profissionais vinculados ao município do gestor logado.
    """
    tenant_id = usuario.get("tenant_id")
    stmt = select(models.Profissional).where(models.Profissional.id_municipio == tenant_id)
    result = await db.execute(stmt)
    profissionais = result.scalars().all()
    
    return [
        {
            "id_profissional": str(p.id_profissional),
            "nome": p.nome,
            "cpf": p.cpf,
            "sn_ativo": p.sn_ativo
        }
        for p in profissionais
    ]