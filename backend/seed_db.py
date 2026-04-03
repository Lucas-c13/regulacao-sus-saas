import uuid
from datetime import datetime, date, time
from database import SessionLocal
from models import Municipio, UBS, Profissional, Especialidade, Paciente, EscalaCentral
from auth import gerar_hash_senha

def seed():
    db = SessionLocal()
    try:
        # 1. Criar um Município (Tenant) com configurações em JSONB
        municipio = Municipio(
            ibge="3106200", # Código fictício
            nome="Prefeitura de Demonstração",
            config_absenteismo={"faltas_limite": 3, "dias_bloqueio": 30},
            tema_visual={"cor_primaria": "#0056b3", "cor_secundaria": "#ffffff"}
        )
        db.add(municipio)
        db.flush() # Gera o ID do município para usarmos abaixo

        # 2. Criar uma UBS vinculada ao Município
        ubs = UBS(
            id_municipio=municipio.id_municipio,
            nome="UBS Centro de Saúde Teste",
            cnes="1234567",
            cep="30130000",
            endereco="Rua Fictícia, 100, Centro"
        )
        db.add(ubs)
        db.flush()

        # 3. Criar um Profissional (Médico) vinculado ao Município
        # 3. Criar um Profissional (Médico) com senha criptografada real
        profissional = Profissional(
            id_municipio=municipio.id_municipio,
            nome="Dr. Lucas Silva",
            cpf="11122233344",
            conselho="CRM-MG 12345",
            # Agora usamos o hash real gerado pela nossa biblioteca de segurança
            senha_hash=gerar_hash_senha("admin123"), 
            sn_ativo=True
        )
        db.add(profissional)
        db.flush()

        # 4. Criar uma Especialidade
        especialidade = Especialidade(
            nome="Clínica Médica",
            is_livre_demanda=True # Aparecerá na App do Cidadão
        )
        db.add(especialidade)
        db.flush()

        # 5. Criar um Paciente (Com aceite LGPD obrigatório e contacto em JSONB)
        paciente = Paciente(
            id_municipio=municipio.id_municipio,
            id_ubs_referencia=ubs.id_ubs,
            nr_cpf="99988877766",
            nr_cns="700012345678901",
            nm_paciente="João da Silva Teste",
            dt_nascimento=date(1980, 5, 20),
            tp_sexo="M",
            contato={"celular": "31999999999"},
            dt_aceite_lgpd=datetime.utcnow() # Regra LGPD cumprida
        )
        db.add(paciente)
        db.flush()

        # 6. Criar o "Molde" da Escala (ESCALA_CENTRAL)
        # O Celery vai ler isto depois para fatiar os slots de 15 em 15 minutos
        escala = EscalaCentral(
            id_ubs=ubs.id_ubs,
            id_profissional=profissional.id_profissional,
            id_especialidade=especialidade.id_especialidade,
            tp_dia_semana=2, # 2 = Segunda-feira
            hr_inicio=time(8, 0),
            hr_fim=time(12, 0),
            qt_atendimento=16,
            tempo_medio_min=15 
        )
        db.add(escala)

        db.commit()
        print("✅ Dados de teste (SaaS de Agendamento APS) inseridos com sucesso!")
        print(f"🏢 ID Município: {municipio.id_municipio}")
        print(f"🏥 ID UBS: {ubs.id_ubs}")
        print(f"👨‍⚕️ ID Profissional: {profissional.id_profissional}")
        print(f"👤 ID Paciente: {paciente.id_paciente}")

    except Exception as e:
        print(f"❌ Erro ao semear banco: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()