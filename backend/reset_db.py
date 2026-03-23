from database import engine, Base
import models

print("⚠️  Limpando e recriando banco de dados...")
# Apaga tudo
Base.metadata.drop_all(bind=engine)
# Cria tudo de novo com as colunas novas
Base.metadata.create_all(bind=engine)
print("✅ Banco resetado com sucesso!")