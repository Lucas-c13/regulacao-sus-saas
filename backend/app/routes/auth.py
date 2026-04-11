from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, validator
import uuid

from ..database.session import get_db
from ..database import models
from ..core.security import verificar_senha, criar_token, gerar_hash, get_usuario_logado

router = APIRouter(prefix="/auth", tags=["Autenticação"])

# --- Esquemas de Validação (Schemas) ---

class VerificaAcessoRequest(BaseModel):
    cpf: str

class RedefinirSenhaRequest(BaseModel):
    """Esquema para a troca obrigatória de senha no primeiro acesso."""
    cpf: str
    senha_atual: str
    nova_senha: str = Field(..., min_length=8, description="A nova senha deve ter no mínimo 8 caracteres")

# --- Rotas de Autenticação ---

@router.post("/verificar-acessos")
async def verificar_acessos(dados: VerificaAcessoRequest, db: AsyncSession = Depends(get_db)):
    """
    Passo 1: Identifica os vínculos do profissional.
    Retorna a lista de municípios onde o CPF possui cadastro ativo.
    """
    stmt = (
        select(models.Profissional, models.Municipio.nome)
        .join(models.Municipio, models.Profissional.id_municipio == models.Municipio.id_municipio)
        .where(
            models.Profissional.cpf == dados.cpf,
            models.Profissional.sn_ativo == True
        )
    )
    
    result = await db.execute(stmt)
    resultados = result.all()

    if not resultados:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="CPF não encontrado ou profissional inativo."
        )

    return {
        "vinculos": [
            {"id_municipio": str(p.id_municipio), "nome_municipio": nome}
            for p, nome in resultados
        ]
    }

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """
    Passo 2: Autenticação em um município específico.
    Implementa a trava de redefinição obrigatória (HTTP 428).
    """
    id_municipio_req = form_data.client_id
    
    if not id_municipio_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="É obrigatório informar o ID do município (client_id)."
        )

    # 1. Busca profissional com filtro de Tenant (Município)
    stmt_prof = select(models.Profissional).where(
        models.Profissional.cpf == form_data.username,
        models.Profissional.id_municipio == id_municipio_req,
        models.Profissional.sn_ativo == True
    )
    
    result_prof = await db.execute(stmt_prof)
    profissional = result_prof.scalars().first()

    # 2. Validação de credenciais
    if not profissional or not verificar_senha(form_data.password, profissional.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciais inválidas para este município."
        )

    # 3. Trava de Primeiro Acesso (Zero Trust)
    # Se a senha for provisória, o sistema impede o login total e exige reset.
    if profissional.is_senha_provisoria:
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED, 
            detail="FIRST_LOGIN_RESET_REQUIRED"
        )

    # 4. Recuperação de contexto operacional (UBS e Permissões)
    stmt_vinculo = select(models.UbsProfissional).where(
        models.UbsProfissional.id_profissional == profissional.id_profissional
    ).limit(1)
    
    result_vinculo = await db.execute(stmt_vinculo)
    vinculo = result_vinculo.scalars().first()

    # 5. Geração de Payload Multi-tenant
    payload = {
        "sub": profissional.cpf,
        "nome": profissional.nome,
        "id_profissional": str(profissional.id_profissional),
        "tenant_id": str(profissional.id_municipio),
        "id_ubs": str(vinculo.id_ubs) if vinculo else None,
        "permissoes": vinculo.permissoes if vinculo else {}
    }
    
    access_token = criar_token(payload)
    
    # 6. Metadados para o Frontend (Identidade Visual)
    stmt_mun = select(models.Municipio).where(models.Municipio.id_municipio == id_municipio_req)
    result_mun = await db.execute(stmt_mun)
    municipio = result_mun.scalars().first()
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "usuario": {
            "nome": profissional.nome,
            "id_profissional": profissional.id_profissional,
            "id_ubs": vinculo.id_ubs if vinculo else None,
            "permissoes": vinculo.permissoes if vinculo else {}
        },
        "municipio": {
            "nome": municipio.nome if municipio else "Desconhecido",
            "tema_visual": municipio.tema_visual if municipio else {}
        }
    }

@router.post("/redefinir-senha")
async def redefinir_senha(
    dados: RedefinirSenhaRequest, 
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint para troca de senha obrigatória ou voluntária.
    Desativa a flag 'is_senha_provisoria' após o sucesso.
    """
    
    # Busca o Profissional no banco pelo CPF
    stmt = select(models.Profissional).where(models.Profissional.cpf == dados.cpf)
    result = await db.execute(stmt)
    current_user = result.scalars().first()
    
    if not current_user:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")

    # 1. Valida se a senha atual confere
    if not verificar_senha(dados.senha_atual, current_user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="A senha atual informada está incorreta."
        )

    # 2. Atualiza para o novo hash e libera o acesso
    novo_hash = gerar_hash(dados.nova_senha)
    
    stmt_update = (
        update(models.Profissional)
        .where(models.Profissional.id_profissional == current_user.id_profissional)
        .values(senha_hash=novo_hash, is_senha_provisoria=False)
    )
    
    await db.execute(stmt_update)
    await db.commit()
    
    return {"message": "Senha atualizada com sucesso. O acesso total foi liberado."}