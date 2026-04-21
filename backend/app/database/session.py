import os
from typing import AsyncGenerator

from sqlalchemy import create_engine, Engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, AsyncEngine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# Configurações via Environment com fallbacks claros
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:postgres@localhost:5432/regulacao_sus"
    "postgresql+asyncpg://postgres:SfYfjWhHjnyElXtOQativILFJcWnTPZJ@postgres.railway.internal:5432/railway"
)

# Derivação da URL síncrona de forma segura
SYNC_DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

# ==========================================
# MOTOR ASSÍNCRONO (API / FastAPI)
# ==========================================
engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    pool_size=50,
    max_overflow=100,
    pool_timeout=30,
    pool_recycle=1800,
    # Sugestão: pre_ping ajuda a recuperar conexões perdidas em ambientes Docker
    pool_pre_ping=True 
)

AsyncSessionLocal = sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# ==========================================
# MOTOR SÍNCRONO (Tasks / Robôs / Scripts)
# ==========================================
sync_engine: Engine = create_engine(
    SYNC_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

# ==========================================
# DEPENDÊNCIAS DE SESSÃO
# ==========================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            # Opcional: Só faz commit automático se a sessão foi alterada
            # Isso evita overhead em rotas de leitura (GET)
            if session.dirty or session.new or session.deleted:
                await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
def get_sync_db():
    """Context Manager para scripts síncronos e Tasks."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()