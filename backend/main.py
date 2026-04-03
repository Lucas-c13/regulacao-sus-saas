from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler

from app.routes import auth, pacientes, agendamentos, profissionais
from app.database.session import engine
from app.database import models
from app.core.middlewares import AuditoriaMiddleware
from app.core.tasks import processar_no_shows 

# Cria as tabelas na inicialização
models.Base.metadata.create_all(bind=engine)

# ==========================================
# GESTOR DE CICLO DE VIDA (LIFESPAN)
# ==========================================
# IMPORTANTE: Esta função precisa existir ANTES de criarmos a variável 'app'
@asynccontextmanager
async def lifespan(app: FastAPI):
    # O que acontece ao LIGAR o servidor:
    scheduler = BackgroundScheduler()
    
    # ⚠️ PARA TESTE: Vamos colocar para rodar a cada 1 minuto
    # Em produção, usaremos: trigger="cron", hour=23, minute=59
    scheduler.add_job(processar_no_shows, 'interval', minutes=1, id="job_no_show")
    
    scheduler.start()
    print("⏰ Motor de Background Tasks (APScheduler) iniciado!")
    
    yield # O FastAPI fica rodando livremente aqui...
    
    # O que acontece ao DESLIGAR o servidor:
    scheduler.shutdown()
    print("🛑 Motor de Background Tasks encerrado.")

# ==========================================
# INICIALIZAÇÃO DA APLICAÇÃO
# ==========================================
# Agora sim, passamos o lifespan que já foi lido pelo Python logo acima
app = FastAPI(title="SaaS Agendamento APS - Modular", lifespan=lifespan)

# ==========================================
# CONFIGURAÇÃO DE CORS (Preparando para o React)
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em Produção, trocaremos para ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],  # Permite GET, POST, PUT, PATCH, DELETE
    allow_headers=["*"],  # Permite envio de Tokens de Autenticação
)

# Registro do Middleware de Auditoria
app.add_middleware(AuditoriaMiddleware)

# Registro dos Routers
app.include_router(auth.router)
app.include_router(pacientes.router)
app.include_router(agendamentos.router)
app.include_router(profissionais.router)

@app.get("/")
def home():
    return {"status": "Online", "arquitetura": "Modular", "seguranca": "Ativa", "jobs": "Ativos"}