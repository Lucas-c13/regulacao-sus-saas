import asyncio
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import engine
from app.database.models import Municipio, UBS, Profissional, Especialidade, Paciente, UbsProfissional
from app.core.security import gerar_hash

async def seed():
    async with AsyncSession(engine) as db:
        try:
            # CORREÇÃO: Agora passamos as novas colunas que o modelo exige
            municipio = Municipio(
                ibge="3106200", 
                nome="Prefeitura de Demonstração",
                nome_exibicao="BH Digital Admin", # Nova coluna
                slug="bh-digital",               # Nova coluna
                cor_primaria="#0056b3",          # Nova coluna
                faltas_limite=3,                 # Nova coluna
                config_absenteismo={"dias_bloqueio": 30},
                tema_visual={"cor_secundaria": "#ffffff"}
            )
            db.add(municipio)
            await db.flush()

            ubs = UBS(
                id_municipio=municipio.id_municipio, 
                nome="UBS Centro de Saúde Teste",
                cnes="1234567", 
                cep="30130000", 
                endereco="Rua Fictícia, 100, Centro"
            )
            db.add(ubs)
            await db.flush()

            especialidade = Especialidade(nome="Clínica Geral", is_livre_demanda=True)
            db.add(especialidade)
            await db.flush()

            profissional = Profissional(
                id_municipio=municipio.id_municipio, 
                nome="Lucas Silva (Administrador)",
                cpf="11122233344", 
                conselho="CRM-MG 12345",
                senha_hash=gerar_hash("admin123"), # Senha: admin123
                sn_ativo=True,
                is_senha_provisoria=False 
            )
            db.add(profissional)
            await db.flush()

            vinculo = UbsProfissional(
                id_profissional=profissional.id_profissional,
                id_ubs=ubs.id_ubs,
                permissoes={"admin_master": True, "is_gestor_prefeitura": True}
            )
            db.add(vinculo)
            await db.flush()

            paciente = Paciente(
                id_municipio=municipio.id_municipio, 
                id_ubs_referencia=ubs.id_ubs,
                nr_cpf="99988877766", 
                nr_cns="700012345678901",
                nm_paciente="João da Silva Teste", 
                dt_nascimento=date(1980, 5, 20),
                tp_sexo="M", 
                contato={"celular": "31999999999"},
                dt_aceite_lgpd=datetime.now()
            )
            db.add(paciente)

            await db.commit()
            print("✅ BANCO POPULADO! Use CPF 11122233344 e senha admin123.")
            
        except Exception as e:
            print(f"❌ Erro ao semear banco: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(seed())