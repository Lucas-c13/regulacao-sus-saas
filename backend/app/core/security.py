from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status 
from fastapi.security import OAuth2PasswordBearer
import os
from dotenv import load_dotenv
from app.database.session import get_db

load_dotenv()

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "7e471f75f98d67cc998b36fa7b9d8cc493bc50d5")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verificar_senha(plana, hash): return pwd_context.verify(plana, hash)
def gerar_hash(senha): return pwd_context.hash(senha)

def criar_token(dados: dict):
    exp = datetime.now(timezone.utc) + timedelta(minutes=480)
    dados.update({"exp": exp})
    return jwt.encode(dados, SECRET_KEY, algorithm=ALGORITHM)

def get_usuario_logado(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

def get_tenant_db(
    usuario: dict = Depends(get_usuario_logado),
    db = Depends(get_db)
):
    """
    Dependência Sênior: Retorna a sessão do banco e o ID do Tenant de uma só vez.
    Libera a passagem sem ID para o admin_master.
    """
    tenant_id = usuario.get("tenant_id")
    role = usuario.get("role")
    
    if role != "admin_master" and not tenant_id:
        raise HTTPException(
            status_code=403, 
            detail="Acesso Negado: Token não possui vínculo com um Município (Tenant)."
        )
        
    return db, tenant_id

# ==========================================
# DEPENDÊNCIAS DE NÍVEL (RBAC)
# ==========================================

def require_admin_master(usuario: dict = Depends(get_usuario_logado)):
    """
    Nível 1 (Admin Master): Acesso Global.
    Exige que o JWT possua 'role': 'admin_master'.
    """
    if usuario.get("role") != "admin_master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso Negado (Nível 1): Privilégios de Administrador Master são obrigatórios."
        )
    return usuario

def require_gestor_prefeitura(usuario: dict = Depends(get_usuario_logado)):
    """
    Nível 2 (Gestor Prefeitura): Restrito ao seu Tenant, mas gere todas as UBSs dele.
    """
    role = usuario.get("role")
    if role not in ["admin_master", "gestor_prefeitura"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso Negado (Nível 2): Apenas o Gestor da Prefeitura pode realizar esta ação."
        )
        
    tenant_id = usuario.get("id_municipio")
    if not tenant_id and role != "admin_master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Acesso Negado: A sua conta não possui Tenant vinculado."
        )
        
    return usuario