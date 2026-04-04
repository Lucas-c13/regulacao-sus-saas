from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import create_engine # <-- Importação síncrona
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:postgres@localhost:5432/regulacao_sus"
)

# ==========================================
# MOTOR ASSÍNCRONO (Para a API / Alta Performance)
# ==========================================
engine = create_async_engine(
    DATABASE_URL,
    echo=False,                
    future=True,
    pool_size=50,              
    max_overflow=100,          
    pool_timeout=30,           
    pool_recycle=1800,         
)

AsyncSessionLocal = sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db():
    """Dependência para injetar a sessão assíncrona nas rotas."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ==========================================
# MOTOR SÍNCRONO (Dedicado para o tasks.py e robôs)
# ==========================================
# Retiramos o '+asyncpg' da string de conexão para usar o psycopg2 tradicional
SYNC_DATABASE_URL = DATABASE_URL.replace("+asyncpg", "")

sync_engine = create_engine(
    SYNC_DATABASE_URL,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine
)