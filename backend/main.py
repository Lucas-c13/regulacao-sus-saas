from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Importações do Agendador (Workers em background)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

# Importações do Redis Cache
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis
import os

# Importações das Rotas e Middlewares
from app.routes import auth, pacientes, agendamentos, profissionais, enderecos, feriados, ubs, escalas, municipios, dashboard, especialidades
from app.core.middlewares import AuditoriaMiddleware

# Importações das Tarefas (Workers)
from app.core.tasks import (
    disparar_lembretes_sms,
    processar_fila_auditoria,
    gerar_agendas_futuras
)

# ==========================================
# GESTOR DE CICLO DE VIDA (LIFESPAN) E WORKERS
# ==========================================
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 A iniciar serviços de background...")
    
    # 1. Ligar o Cache Redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=True)
    FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
    print("✅ Redis Cache Conectado.")

    # 2. Agendar Tarefas (Workers)
    
    # Tarefa A: Bulk Insert da Auditoria (Limpa o Redis a cada 15 segundos)
    scheduler.add_job(
        processar_fila_auditoria, 
        trigger=IntervalTrigger(seconds=15),
        id="auditoria_worker",
        replace_existing=True
    )

    # Tarefa B: Fatiador Automático de Escalas (Roda de madrugada para gerar vagas)
    scheduler.add_job(
        gerar_agendas_futuras, 
        trigger=CronTrigger(hour=2, minute=0), 
        id="job_gerador_agendas",
        replace_existing=True
    )
    
    # Tarefa C: Lembretes SMS (Roda todos os dias às 18:00)
    scheduler.add_job(
        disparar_lembretes_sms, 
        trigger=CronTrigger(hour=18, minute=0, timezone='America/Sao_Paulo'),
        id='lembretes_diarios',
        replace_existing=True
    )

    # (Opcional) Tarefa D: Processar No-Shows (Podes adicionar aqui se já tiveres a função)
    # scheduler.add_job(processar_no_shows, trigger=IntervalTrigger(minutes=1), id="job_no_show")

    scheduler.start()
    print("⏰ Motor de Background Tasks (APScheduler) iniciado com sucesso!")
    
    # A API fica online a partir daqui
    yield 
    
    # O que acontece ao DESLIGAR o servidor:
    scheduler.shutdown()
    await redis.close()
    print("🛑 Serviços de Background encerrados com segurança.")


# ==========================================
# INICIALIZAÇÃO DA APLICAÇÃO
# ==========================================
app = FastAPI(title="SaaS Agendamento APS - Modular", lifespan=lifespan)

# ==========================================
# CONFIGURAÇÃO DE CORS E MIDDLEWARES
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em Produção, limite isto ao domínio do Frontend App/Web
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# Registo do Middleware de Auditoria (Apenas uma vez)
app.add_middleware(AuditoriaMiddleware)

# ==========================================
# REGISTO DAS ROTAS (ENDPOINTS)
# ==========================================
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
        "status": "Online", 
        "arquitetura": "Modular & Async", 
        "seguranca": "Ativa", 
        "cache": "Redis Ativo",
        "jobs": "Ativos"
    }