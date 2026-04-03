from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import os

# Configuração para criptografia de senhas (Argon2 para compatibilidade com Python 3.14)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Configurações do JWT
SECRET_KEY = os.getenv("SECRET_KEY", "7e471f75f98d67cc998b36fa7b9d8cc493bc50d5")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

# Define o esquema de autenticação que será usado nas rotas
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verificar_senha(senha_plana: str, senha_hash: str):
    """Compara a senha digitada com o hash do banco."""
    return pwd_context.verify(senha_plana, senha_hash)

def gerar_hash_senha(senha: str):
    """Gera o hash seguro para salvar no banco."""
    return pwd_context.hash(senha)

def criar_token_acesso(dados: dict):
    """Gera o token JWT para o usuário logado."""
    # Atualizado para Python 3.14: datetime.now(timezone.utc)
    expira = datetime.now(timezone.utc) + timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480)))
    dados.update({"exp": expira})
    return jwt.encode(dados, SECRET_KEY, algorithm=ALGORITHM)

def get_usuario_logado(token: str = Depends(oauth2_scheme)):
    """Dependência para extrair e validar o usuário do token JWT."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload # Retorna o dicionário com id_municipio e id_profissional
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")