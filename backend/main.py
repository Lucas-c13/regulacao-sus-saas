from fastapi import FastAPI
from app.routes import auth, pacientes, agendamentos
from app.database.session import engine
from app.database import models
from app.core.middlewares import AuditoriaMiddleware

# Cria as tabelas na inicialização
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SaaS Agendamento APS - Modular")

# Registro dos Routers
app.include_router(auth.router)
app.include_router(pacientes.router)
app.include_router(agendamentos.router)
app.add_middleware(AuditoriaMiddleware)

@app.get("/")
def home():
    return {"status": "Online", "arquitetura": "Modular", "seguranca": "Ativa"}