import requests
from datetime import date
from app.database.session import SessionLocal
from app.database.models import Paciente, EscalaCentral

def testar_fluxo_cancelamento():
    print("🚀 Iniciando Teste de Agendamento e Cancelamento...\n")

    # 1. Buscar um Paciente e uma Escala no banco de dados
    db = SessionLocal()
    paciente = db.query(Paciente).first()
    escala = db.query(EscalaCentral).first()
    db.close()

    if not paciente or not escala:
        print("❌ Dados não encontrados. Rode 'python seed_db.py' primeiro.")
        return

    # ==========================================
    # PASSO 1: O CIDADÃO FAZ O AGENDAMENTO (Status 'M')
    # ==========================================
    payload_agendamento = {
        "id_paciente": str(paciente.id_paciente),
        "id_escala": str(escala.id_escala),
        "data_agendamento": date.today().isoformat(),
        "hora_vaga": "08:30:00" # Pegando o slot das 08:30
    }

    print(f"📅 1. Cidadão {paciente.nm_paciente} tentando agendar para 08:30...")
    resp_agendar = requests.post("http://127.0.0.1:8000/agendamentos/", json=payload_agendamento)

    if resp_agendar.status_code == 409:
        print("⚠️ O horário 08:30 já está ocupado. Rode 'python reset_db.py' e 'python seed_db.py' para limpar o banco.")
        return
    elif resp_agendar.status_code != 200:
        print(f"❌ Erro ao agendar: {resp_agendar.text}")
        return

    dados_agendamento = resp_agendar.json()
    id_item = dados_agendamento["id_item"]
    print(f"✅ Agendamento Confirmado! Status virou 'M' (Marcado). ID da reserva: {id_item}\n")

    # ==========================================
    # PASSO 2: O CIDADÃO CANCELA A CONSULTA (Status 'C')
    # ==========================================
    print("🗑️ 2. Simulando o cidadão cancelando pelo App...")
    resp_cancelar = requests.patch(f"http://127.0.0.1:8000/agendamentos/{id_item}/cancelar")

    if resp_cancelar.status_code == 200:
        print(f"✅ SUCESSO! A API retornou: {resp_cancelar.json()['msg']}")
        print(f"🔄 Novo Status no Banco: {resp_cancelar.json()['novo_status']} (Cancelado)")
    else:
        print(f"❌ Erro ao cancelar: {resp_cancelar.status_code} - {resp_cancelar.text}")

    # ==========================================
    # PASSO 3: TESTE DE SEGURANÇA (Prevenção de Duplo Cancelamento)
    # ==========================================
    print("\n🛡️ 3. Tentando cancelar a mesma consulta novamente (Hacker/Bug no App)...")
    resp_falha = requests.patch(f"http://127.0.0.1:8000/agendamentos/{id_item}/cancelar")
    
    if resp_falha.status_code == 400:
        print(f"✅ Bloqueado corretamente! A API disse: {resp_falha.json()['detail']}")
    else:
        print("❌ Falhou na segurança, permitiu cancelar duas vezes.")

if __name__ == "__main__":
    testar_fluxo_cancelamento()