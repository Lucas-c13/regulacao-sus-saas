from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import uuid

from ..database.session import get_db
from ..database import models
# Importe o nome correto da sua função de criar token (ajuste se for criar_token ou criar_token_acesso)
from ..core.security import verificar_senha, criar_token 

router = APIRouter(prefix="/auth", tags=["Autenticação"])

class VerificaAcessoRequest(BaseModel):
    cpf: str

@router.post("/verificar-acessos")
async def verificar_acessos(dados: VerificaAcessoRequest, db: AsyncSession = Depends(get_db)):
    """
    Passo 1: Recebe o CPF e devolve todas as prefeituras onde o profissional possui vínculo.
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

    vinculos = [
        {
            "id_municipio": str(prof.id_municipio),
            "nome_municipio": nome_municipio
        }
        for prof, nome_municipio in resultados
    ]

    return {"vinculos": vinculos}

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """
    Passo 2: Efetua o login num município específico selecionado no app/web.
    O client_id do formulário é usado para passar o id_municipio.
    """
    id_municipio_req = form_data.client_id
    
    if not id_municipio_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="É obrigatório informar o ID do município (client_id)."
        )

    # 1. Buscar o profissional pelo CPF e Município
    # Convertemos para UUID se o banco exigir, ou passamos a string se o driver aceitar
    stmt_prof = select(models.Profissional).where(
        models.Profissional.cpf == form_data.username,
        models.Profissional.id_municipio == id_municipio_req,
        models.Profissional.sn_ativo == True
    )
    
    result_prof = await db.execute(stmt_prof)
    profissional = result_prof.scalars().first()

    # 2. Validar existência e senha
    if not profissional or not verificar_senha(form_data.password, profissional.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="CPF, senha ou município incorretos."
        )

    # 3. Gerar o Payload do Token (VITAL para o Tenant Enforcement)
    # A chave 'tenant_id' é a que usamos nos filtros WHERE das outras rotas
    payload = {
        "sub": profissional.cpf,
        "nome": profissional.nome,
        "id_profissional": str(profissional.id_profissional),
        "tenant_id": str(profissional.id_municipio) 
    }
    
    token = criar_token(payload)
    
    # 4. Buscar informações visuais do município para o frontend
    stmt_mun = select(models.Municipio).where(models.Municipio.id_municipio == id_municipio_req)
    result_mun = await db.execute(stmt_mun)
    municipio = result_mun.scalars().first()
    
    return {
        "access_token": token, 
        "token_type": "bearer",
        "usuario": {
            "nome": profissional.nome,
            "id_profissional": profissional.id_profissional
        },
        "municipio": {
            "nome": municipio.nome if municipio else "Desconhecido",
            "tema_visual": municipio.tema_visual if municipio else None
        }
    }