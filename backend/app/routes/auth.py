from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database.session import get_db
from ..database import models
from ..core.security import verificar_senha, criar_token

router = APIRouter(prefix="/auth", tags=["Autenticação"])

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Busca o profissional pelo CPF (enviado como username)
    profissional = db.query(models.Profissional).filter(
        models.Profissional.cpf == form_data.username
    ).first()

    if not profissional or not verificar_senha(form_data.password, profissional.senha_hash):
        raise HTTPException(status_code=401, detail="CPF ou senha incorretos")

    token = criar_token({
        "sub": profissional.cpf,
        "id_profissional": str(profissional.id_profissional),
        "id_municipio": str(profissional.id_municipio)
    })
    return {"access_token": token, "token_type": "bearer"}