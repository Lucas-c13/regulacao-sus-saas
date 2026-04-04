from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database.session import get_db
from ..database import models
from ..core.security import verificar_senha, criar_token

router = APIRouter(prefix="/auth", tags=["Autenticação"])

class VerificaAcessoRequest(BaseModel):
    cpf: str

@router.post("/verificar-acessos")
async def verificar_acessos(dados: VerificaAcessoRequest, db: AsyncSession = Depends(get_db)):
    """
    Passo 1: Recebe o CPF e devolve todas as prefeituras onde ele possui vínculo.
    """
    # NOVO PADRÃO ASYNC: select() -> await db.execute() -> result.all()
    stmt = (
        select(models.Profissional, models.Municipio.nome)
        .join(models.Municipio, models.Profissional.id_municipio == models.Municipio.id_municipio)
        .where(
            models.Profissional.cpf == dados.cpf,
            models.Profissional.sn_ativo == True
        )
    )
    
    result = await db.execute(stmt)
    resultados = result.all() # Retorna uma lista de tuplas (Profissional, nome_municipio)

    if not resultados:
        raise HTTPException(status_code=404, detail="CPF não encontrado ou utilizador inativo.")

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
    Passo 2: Efetua o login num município específico.
    """
    id_municipio = form_data.client_id
    
    if not id_municipio:
        raise HTTPException(status_code=400, detail="É obrigatório informar a prefeitura (client_id).")

    # Substituição de db.query().filter().first() por await db.execute(select().where())
    stmt_prof = select(models.Profissional).where(
        models.Profissional.cpf == form_data.username,
        models.Profissional.id_municipio == id_municipio
    )
    
    result_prof = await db.execute(stmt_prof)
    profissional = result_prof.scalars().first() # scalars() extrai o objeto da tupla do banco

    if not profissional or not verificar_senha(form_data.password, profissional.senha_hash):
        raise HTTPException(status_code=401, detail="CPF, senha ou prefeitura incorretos.")

    token = criar_token({
        "sub": profissional.cpf,
        "id_profissional": str(profissional.id_profissional),
        "id_municipio": str(profissional.id_municipio)
    })
    
    # Buscar o tema visual
    stmt_mun = select(models.Municipio).where(models.Municipio.id_municipio == id_municipio)
    result_mun = await db.execute(stmt_mun)
    municipio = result_mun.scalars().first()
    
    return {
        "access_token": token, 
        "token_type": "bearer",
        "tema_visual": municipio.tema_visual if municipio else None
    }