import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
from dotenv import load_dotenv

# 1. Carregar as variáveis do .env
load_dotenv()

# 2. Importar a Base e as URLs do session.py
from app.database.session import Base, SYNC_DATABASE_URL
import app.database.models  # Garante que os modelos sejam lidos na memória

# 3. Configurar o target_metadata
target_metadata = Base.metadata

config = context.config

# 4. FORÇAR O USO DA URL SÍNCRONA
# Mesmo que o .env tenha DATABASE_URL com asyncpg, 
# o Alembic precisa da versão síncrona (psycopg2)
config.set_main_option("sqlalchemy.url", SYNC_DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

def run_migrations_offline() -> None:
    # Aqui ele pega a SYNC_DATABASE_URL que setamos acima
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    # engine_from_config vai criar um motor síncrono usando psycopg2
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()