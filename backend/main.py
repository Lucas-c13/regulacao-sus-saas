import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis

# Rotas
from app.routes import (
    auth, pacientes, agendamentos, profissionais, enderecos, 
    feriados, ubs, escalas, municipios, dashboard, especialidades
)
from app.core.middlewares import AuditoriaMiddleware

# --- IMPORTAÇÃO CENTRALIZADA DO SCHEDULER ---
# Importamos o scheduler ÚNICO e a função de configuração do tasks.py
from app.core.tasks import scheduler, configurar_agendamentos

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Iniciando motor de serviços SaaS...")
    
    # 1. Configuração do Redis Cache
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=True)
    FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")

    # 2. Configuração e Início dos Workers (APScheduler)
    # Chamamos a função que define os horários (Auditoria, No-Show, Agendas, SMS)
    configurar_agendamentos()
    
    if not scheduler.running:
        scheduler.start()
        print("✅ Scheduler e Workers em background operacionais!")
    
    yield 
    
    # 3. Desligamento gracioso
    if scheduler.running:
        scheduler.shutdown()
    await redis.close()
    print("🛑 Serviços encerrados com segurança.")

# Inicialização da APP
app = FastAPI(
    title="SaaS Agendamento APS",
    description="Sistema Multi-tenant de Regulação de Saúde",
    version="1.0.0",
    lifespan=lifespan
)

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)
app.add_middleware(AuditoriaMiddleware)

# Registro de Rotas
app.include_router(auth.router)
app.include_router(pacientes.router)
app.include_router(agendamentos.router)
app.include_router(profissionais.router)
app.include_router(enderecos.router)
app.include_router(feriados.router)
app.include_router(ubs.router)
app.include_router(escalas.router)
app.include_router(municipios.router)
app.include_router(dashboard.router)
app.include_router(especialidades.router)

@app.get("/")
def home():
    return {
        "status": "SaaS Online",
        "timezone": "America/Sao_Paulo",
        "workers": "Active" if scheduler.running else "Inactive"
    }