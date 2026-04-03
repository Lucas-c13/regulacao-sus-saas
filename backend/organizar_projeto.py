import os
from pathlib import Path

# Configuração da estrutura de pastas [cite: 7, 8]
folders = [
    "app",
    "app/core",
    "app/database",
    "app/routes",
    "app/schemas",
    "app/services",
]

# 1. Criar pastas
for folder in folders:
    Path(folder).mkdir(parents=True, exist_ok=True)
    # Cria o __init__.py para transformar em pacotes Python
    Path(f"{folder}/__init__.py").touch()

print("✅ Estrutura de pastas criada.")

# 2. Definir conteúdos dos arquivos baseados no seu código atual
# ---------------------------------------------------------

# app/database/session.py
session_content = """from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

SQLALCHEMY_DATABASE_URL = "postgresql://admin:admin_password@localhost:5432/db_regulacao"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
"""

# app/core/security.py
security_content = """from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import os

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
"""

# app/schemas/schemas.py
schemas_content = """from pydantic import BaseModel
from datetime import date, time

class CadastroPacienteApp(BaseModel):
    id_municipio: str
    id_ubs_referencia: str
    celular: str
    aceitou_lgpd: bool

class NovoAgendamentoApp(BaseModel):
    id_paciente: str
    id_escala: str
    data_agendamento: date
    hora_vaga: time

class AtualizaStatusAgendamento(BaseModel):
    novo_status: str
"""

# 3. Escrever os arquivos
files = {
    "app/database/session.py": session_content,
    "app/core/security.py": security_content,
    "app/schemas/schemas.py": schemas_content,
}

for path, content in files.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

print("🚀 Arquivos base criados. Agora seu projeto está modular!")