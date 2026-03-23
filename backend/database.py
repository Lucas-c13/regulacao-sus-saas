from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Configuração para o banco que está no Docker
SQLALCHEMY_DATABASE_URL = "postgresql://admin:admin_password@localhost:5432/db_regulacao"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# A função que estava faltando:
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()