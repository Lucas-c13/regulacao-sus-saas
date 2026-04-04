from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database.session import get_db
from ..database import models
from ..core.security import verificar_senha, criar_token

router = APIRouter(prefix="/auth", tags=["Autenticação"])

class VerificaAcessoRequest(BaseModel):
    cpf: str

@router.post("/verificar-acessos")
def verificar_acessos(dados: VerificaAcessoRequest, db: Session = Depends(get_db)):
    """
    Passo 1: Recebe o CPF e devolve todas as prefeituras onde ele possui vínculo.
    """
    # Fazemos um JOIN com a tabela Município para pegar o nome da Prefeitura
    resultados = db.query(models.Profissional, models.Municipio.nome).join(
        models.Municipio, models.Profissional.id_municipio == models.Municipio.id_municipio
    ).filter(
        models.Profissional.cpf == dados.cpf,
        models.Profissional.sn_ativo == True
    ).all()

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
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Passo 2: Efetua o login num município específico.
    Hack Sênior: Usamos o campo 'client_id' (Client ID) do Swagger para enviar o id_municipio.
    """
    id_municipio = form_data.client_id
    
    if not id_municipio:
        raise HTTPException(status_code=400, detail="É obrigatório informar a prefeitura (client_id).")

    profissional = db.query(models.Profissional).filter(
        models.Profissional.cpf == form_data.username,
        models.Profissional.id_municipio == id_municipio
    ).first()

    if not profissional or not verificar_senha(form_data.password, profissional.senha_hash):
        raise HTTPException(status_code=401, detail="CPF, senha ou prefeitura incorretos.")

    token = criar_token({
        "sub": profissional.cpf,
        "id_profissional": str(profissional.id_profissional),
        "id_municipio": str(profissional.id_municipio)
    })
    
    # Devolvemos também o tema visual para o React pintar a tela na mesma hora
    municipio = db.query(models.Municipio).filter(models.Municipio.id_municipio == id_municipio).first()
    
    return {
        "access_token": token, 
        "token_type": "bearer",
        "tema_visual": municipio.tema_visual if municipio else None
    }