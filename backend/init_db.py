from database import engine, Base
import models

print("🚀 Conectando ao PostgreSQL no Docker...")
try:
    # Este comando lê os modelos e cria as tabelas no banco "burro"
    Base.metadata.create_all(bind=engine)
    print("✅ Sucesso! Tabelas 'clientes', 'pacientes' e 'solicitacoes' criadas.")
except Exception as e:
    print(f"❌ Erro ao criar tabelas: {e}")