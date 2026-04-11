import asyncio
from datetime import datetime, date, time, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import engine
from app.database.models import Municipio, UBS, Profissional, Especialidade, Paciente, EscalaCentral, UbsProfissional
from app.core.security import gerar_hash

async def seed():
    async with AsyncSession(engine) as db:
        try:
            municipio = Municipio(
                ibge="3106200", nome="Prefeitura de Demonstração (Admin Central)",
                config_absenteismo={"faltas_limite": 3, "dias_bloqueio": 30},
                tema_visual={"cor_primaria": "#0056b3", "cor_secundaria": "#ffffff"}
            )
            db.add(municipio)
            await db.flush()

            ubs = UBS(
                id_municipio=municipio.id_municipio, nome="UBS Centro de Saúde Teste",
                cnes="1234567", cep="30130000", endereco="Rua Fictícia, 100, Centro"
            )
            db.add(ubs)
            await db.flush()

            profissional = Profissional(
                id_municipio=municipio.id_municipio, nome="Lucas Silva (Administrador)",
                cpf="11122233344", conselho="CRM-MG 12345",
                senha_hash=gerar_hash("admin123"), # Senha inicial: admin123
                sn_ativo=True,
                is_senha_provisoria=False # Libera o login direto sem forçar reset de primeira viagem
            )
            db.add(profissional)
            await db.flush()

            vinculo = UbsProfissional(
                id_profissional=profissional.id_profissional,
                id_ubs=ubs.id_ubs,
                permissoes={"is_gestor_local": True}
            )
            db.add(vinculo)
            await db.flush()

            paciente = Paciente(
                id_municipio=municipio.id_municipio, id_ubs_referencia=ubs.id_ubs,
                nr_cpf="99988877766", nr_cns="700012345678901",
                nm_paciente="João da Silva Teste", dt_nascimento=date(1980, 5, 20),
                tp_sexo="M", contato={"celular": "31999999999"},
                dt_aceite_lgpd=datetime.now() # Usa timestamp naive para o asyncpg (sem fuso)
            )
            db.add(paciente)

            await db.commit()
            print("✅ ADMIN CRIADO! Use o CPF 11122233344 e a senha admin123 no painel de Login.")
        except Exception as e:
            print(f"❌ Erro ao semear banco: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(seed())