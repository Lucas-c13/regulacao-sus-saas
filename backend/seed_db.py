import uuid
from datetime import datetime
from database import SessionLocal
from models import Cliente, Paciente, Solicitacao

def seed():
    db = SessionLocal()
    try:
        # 1. Criar um Município (Tenant)
        municipio = Cliente(
            nome_municipio="Belo Horizonte",
            cnpj="12345678000199"
        )
        db.add(municipio)
        db.flush() # Gera o ID do município para usarmos abaixo

        # 2. Criar um Paciente vinculado a este município
        paciente = Paciente(
            cliente_id=municipio.id,
            nome_completo="JOAO DA SILVA TESTE",
            cpf="11122233344",
            cns="700012345678901",
            data_nascimento=datetime(1980, 5, 20)
        )
        db.add(paciente)
        db.flush()

        # 3. Criar uma Solicitação (O que o robô SISREG vai buscar)
        solicitacao = Solicitacao(
            cliente_id=municipio.id,
            paciente_id=paciente.id,
            status="AGUARDANDO_ROBO", # Status gatilho para o Selenium
            prioridade="Moderado",
            justificativa="Paciente apresenta quadro clínico compatível com teste de sistema."
        )
        db.add(solicitacao)
        
        db.commit()
        print(f"✅ Dados de teste inseridos!")
        print(f"ID do Município: {municipio.id}")
        print(f"ID da Solicitação: {solicitacao.id}")

    except Exception as e:
        print(f"❌ Erro ao semear banco: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()