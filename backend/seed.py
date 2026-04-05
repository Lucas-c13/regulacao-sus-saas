import asyncio
from sqlalchemy import update
from app.database.session import AsyncSessionLocal
from app.database.models import Profissional
from app.core.security import gerar_hash

async def reset_admin():
    async with AsyncSessionLocal() as db:
        # Atualiza o utilizador existente
        stmt = (
            update(Profissional)
            .where(Profissional.cpf == '11122233344')
            .values(
                senha_hash=gerar_hash('admin123'),
                sn_ativo=True
            )
        )
        resultado = await db.execute(stmt)
        await db.commit()
        
        if resultado.rowcount > 0:
            print('✅ Senha redefinida e utilizador ativado com sucesso!')
        else:
            print('⚠️ Nenhum utilizador atualizado. Verifique o CPF.')

if __name__ == "__main__":
    asyncio.run(reset_admin())