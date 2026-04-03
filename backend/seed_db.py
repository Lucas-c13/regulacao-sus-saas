import uuid
from datetime import datetime, date, time, timezone
from app.database.session import SessionLocal
from app.database.models import Municipio, UBS, Profissional, Especialidade, Paciente, EscalaCentral
from app.core.security import gerar_hash # O nome da função mudou no novo core de segurança

def seed():
    db = SessionLocal()
    try:
        municipio = Municipio(
            ibge="3106200", nome="Prefeitura de Demonstração",
            config_absenteismo={"faltas_limite": 3, "dias_bloqueio": 30},
            tema_visual={"cor_primaria": "#0056b3", "cor_secundaria": "#ffffff"}
        )
        db.add(municipio); db.flush()

        ubs = UBS(
            id_municipio=municipio.id_municipio, nome="UBS Centro de Saúde Teste",
            cnes="1234567", cep="30130000", endereco="Rua Fictícia, 100, Centro"
        )
        db.add(ubs); db.flush()

        profissional = Profissional(
            id_municipio=municipio.id_municipio, nome="Dr. Lucas Silva",
            cpf="11122233344", conselho="CRM-MG 12345",
            senha_hash=gerar_hash("admin123"), # Usando a função do app/core/security.py
            sn_ativo=True
        )
        db.add(profissional); db.flush()

        especialidade = Especialidade(nome="Clínica Médica", is_livre_demanda=True)
        db.add(especialidade); db.flush()

        paciente = Paciente(
            id_municipio=municipio.id_municipio, id_ubs_referencia=ubs.id_ubs,
            nr_cpf="99988877766", nr_cns="700012345678901",
            nm_paciente="João da Silva Teste", dt_nascimento=date(1980, 5, 20),
            tp_sexo="M", contato={"celular": "31999999999"},
            dt_aceite_lgpd=datetime.now(timezone.utc) # Atualizado para Python 3.14
        )
        db.add(paciente); db.flush()

        escala = EscalaCentral(
            id_ubs=ubs.id_ubs, id_profissional=profissional.id_profissional,
            id_especialidade=especialidade.id_especialidade, tp_dia_semana=2,
            hr_inicio=time(8, 0), hr_fim=time(12, 0),
            qt_atendimento=16, tempo_medio_min=15 
        )
        db.add(escala)

        db.commit()
        print("✅ Dados de teste (SaaS de Agendamento APS) inseridos com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao semear banco: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()