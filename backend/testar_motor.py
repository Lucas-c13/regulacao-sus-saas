import requests
from datetime import date
from app.database.session import SessionLocal
from app.database.models import EscalaCentral

def executar_teste():
    print("🚀 A iniciar teste ao Motor de Disponibilidade...\n")

    # 1. Vamos buscar o ID da Escala gerada pelo seu seed_db.py
    db = SessionLocal()
    escala = db.query(EscalaCentral).first()
    db.close()

    if not escala:
        print("❌ Nenhuma escala encontrada na base de dados.")
        print("💡 Dica: Corra 'python seed_db.py' primeiro para popular os dados.")
        return

    id_escala = str(escala.id_escala)
    data_teste = date.today().isoformat()

    # 2. Construir o URL para o nosso novo endpoint
    # Nota: O endpoint está no router de agendamentos, logo o prefixo é /agendamentos
    url = f"http://127.0.0.1:8000/agendamentos/disponiveis?id_escala={id_escala}&data_consulta={data_teste}"
    
    print(f"🔍 A consultar a API em: {url}")

    # 3. Fazer o pedido HTTP
    try:
        response = requests.get(url)
    except requests.exceptions.ConnectionError:
        print("❌ Erro de conexão. Esqueceu-se de ligar o servidor FastAPI?")
        print("💡 Dica: Corra 'uvicorn main:app --reload' num terminal separado.")
        return

    # 4. Avaliar o resultado
    if response.status_code == 200:
        dados = response.json()
        print("\n✅ SUCESSO! A API respondeu corretamente.")
        print("-" * 40)
        print(f"🩺 ID Escala: {dados['id_escala']}")
        print(f"⏱️ Tempo Médio (Consulta): {dados['tempo_atendimento_min']} minutos")
        print(f"🟢 Vagas Livres Encontradas: {dados['total_vagas_livres']}")
        print(f"📅 Grelha de Horários:\n   {dados['horarios_disponiveis']}")
        print("-" * 40)
        
        # Validação Sênior: Verificando se o cálculo está matematicamente correto
        if dados['total_vagas_livres'] == 16:
            print("🏆 Teste de Lógica: Aprovado! Fatiou exatamente 4 horas em blocos de 15 min.")
    else:
        print(f"\n❌ ERRO {response.status_code}: {response.text}")

if __name__ == "__main__":
    executar_teste()