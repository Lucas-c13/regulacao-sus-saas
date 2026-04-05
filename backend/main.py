from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

# Importações do Redis Cache
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis
import os

# Importações das Rotas e Middlewares
from app.routes import auth, pacientes, agendamentos, profissionais, enderecos, feriados, ubs
from app.core.middlewares import AuditoriaMiddleware
from app.core.tasks import disparar_lembretes_sms
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager


# ==========================================
# GESTOR DE CICLO DE VIDA (LIFESPAN)
# ==========================================
# Aqui ligamos tudo ANTES da API aceitar requisições
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 A iniciar serviços de background...")
    
    # 1. Ligar o Cache Redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=True)
    FastAPICache.init(RedisBackend(redis), prefix="fastapi-cache")
    print("✅ Redis Cache Conectado.")

    # 2. Ligar o Motor de Tarefas (APScheduler)
    scheduler = BackgroundScheduler()
    
    # Tarefa 1: Processar Faltas
    scheduler.add_job(processar_no_shows, 'interval', minutes=1, id="job_no_show")

    # Tarefa 2: Gerador de Agendas em Massa 
    scheduler.add_job(gerar_agendas_automaticamente, 'interval', minutes=1, id="job_gerador_agendas")
    
    scheduler.start()
    print("⏰ Motor de Background Tasks (APScheduler) iniciado com 2 rotinas!")
    
    # A API fica online a partir daqui
    yield 
    
    # O que acontece ao DESLIGAR o servidor:
    scheduler.shutdown()
    await redis.close()
    print("🛑 Serviços de Background encerrados.")

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Arranca o cron job que envia SMS todos os dias às 18:00
    scheduler.add_job(
        disparar_lembretes_sms, 
        'cron', 
        hour=18, 
        minute=0, 
        timezone='America/Sao_Paulo',
        id='lembretes_diarios'
    )
    scheduler.start()
    print("⏰ Motor de Lembretes APScheduler iniciado!")
    
    yield 
    
    # Desliga o cron job quando o servidor parar
    scheduler.shutdown()
    print("⏰ Motor de Lembretes desligado com segurança.")

# Atualiza a declaração da tua app para incluir o lifespan:
app = FastAPI(title="SaaS Regulação SUS", lifespan=lifespan)
# ==========================================
# INICIALIZAÇÃO DA APLICAÇÃO
# ==========================================
app = FastAPI(title="SaaS Agendamento APS - Modular", lifespan=lifespan)

# ==========================================
# CONFIGURAÇÃO DE CORS E MIDDLEWARES
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em Produção, limite isto ao IP do seu Frontend
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# Registo do Middleware de Auditoria (Deve vir depois do CORS)
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

@app.get("/")
def home():
    return {
        "status": "Online", 
        "arquitetura": "Modular & Async", 
        "seguranca": "Ativa", 
        "cache": "Redis Ativo",
        "jobs": "Ativos"
    }