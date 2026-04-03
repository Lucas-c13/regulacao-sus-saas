import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
from dotenv import load_dotenv

# 1. Carregar as variáveis do .env
load_dotenv()

# 2. Importar a Base do seu projeto
from app.database.session import Base
import app.database.models  # Garante que os modelos sejam lidos na memória

# 3. Configurar o target_metadata para o Alembic ler a estrutura das tabelas
target_metadata = Base.metadata

config = context.config

# 4. Injetar a URL do banco de dados vinda do .env diretamente no Alembic
banco_url = os.getenv("DATABASE_URL")
if not banco_url:
    raise ValueError("DATABASE_URL não encontrada no arquivo .env")
config.set_main_option("sqlalchemy.url", banco_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

def run_migrations_offline() -> None:
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