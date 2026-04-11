import asyncio
from app.database.session import engine, Base
from app.database import models

async def reset_db():
    print("⚠️  Limpando e recriando banco de dados...")
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.drop_all)
        await conn.run_sync(models.Base.metadata.create_all)
    print("✅ Banco resetado com sucesso!")

if __name__ == "__main__":
    asyncio.run(reset_db())