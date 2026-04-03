from app.database.session import engine, Base
from app.database import models

print("⚠️  Limpando e recriando banco de dados...")
models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)
print("✅ Banco resetado com sucesso!")