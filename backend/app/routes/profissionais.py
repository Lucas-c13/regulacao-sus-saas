# app/routes/profissionais.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado, get_tenant_db, gerar_hash

router = APIRouter(prefix="/profissionais", tags=["Profissionais e Acessos"])

@router.post("/")
def criar_profissional_ubs(
    dados: schemas.NovoProfissionalUBS,
    db_tenant: tuple = Depends(get_tenant_db),
    usuario_logado: dict = Depends(get_usuario_logado)
):
    db, tenant_id = db_tenant

    # 1. REGRA CRÍTICA: Verificar se o utilizador logado é Gestor Local DESTA UBS
    vinculo_gestor = db.query(models.UbsProfissional).filter(
        models.UbsProfissional.id_profissional == usuario_logado["id_profissional"],
        models.UbsProfissional.id_ubs == dados.id_ubs
    ).first()

    # Validamos se o vínculo existe e se a flag is_gestor_local é verdadeira dentro do JSONB
    if not vinculo_gestor or not vinculo_gestor.permissoes or not vinculo_gestor.permissoes.get("is_gestor_local"):
        raise HTTPException(
            status_code=403, 
            detail="Acesso negado: Apenas um Gestor Local pode criar utilizadores para esta UBS."
        )

    # 2. Tenant Enforcement: Verificar se o CPF já existe neste Município
    existente = db.query(models.Profissional).filter(
        models.Profissional.cpf == dados.cpf,
        models.Profissional.id_municipio == tenant_id
    ).first()
    
    if existente:
        raise HTTPException(status_code=409, detail="CPF já registado neste município.")

    # 3. Criar o novo utilizador garantindo o isolamento do Tenant
    novo_prof = models.Profissional(
        id_municipio=tenant_id,
        nome=dados.nome,
        cpf=dados.cpf,
        senha_hash=gerar_hash(dados.senha),
        sn_ativo=True
    )
    db.add(novo_prof)
    db.flush() # Força a geração do id_profissional na base de dados antes do commit final

    # 4. Vincular o novo utilizador ESTRITAMENTE à mesma UBS solicitada
    novo_vinculo = models.UbsProfissional(
        id_ubs=dados.id_ubs,
        id_profissional=novo_prof.id_profissional,
        # O novo utilizador nasce com permissões restritas (Nível 3 comum)
        permissoes={"is_gestor_local": False, "can_create_escala": False} 
    )
    db.add(novo_vinculo)
    db.commit()

    return {
        "msg": "Profissional criado e vinculado com sucesso!", 
        "id_profissional": novo_prof.id_profissional
    }