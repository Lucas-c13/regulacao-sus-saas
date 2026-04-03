import requests
from app.database.session import SessionLocal
from app.database.models import Profissional, UBS, UbsProfissional

def preparar_banco_e_testar():
    print("🚀 Iniciando Teste de Segurança RBAC e Multi-tenant...\n")
    
    # ==========================================
    # 1. PREPARAR O BANCO (Dar poderes ao Dr. Lucas)
    # ==========================================
    db = SessionLocal()
    lucas = db.query(Profissional).filter(Profissional.cpf == "11122233344").first()
    ubs = db.query(UBS).first()

    if not lucas or not ubs:
        print("❌ Dados não encontrados. Rode 'python seed_db.py' primeiro.")
        return

    # Verifica se já tem o vínculo, se não, cria.
    vinculo = db.query(UbsProfissional).filter(
        UbsProfissional.id_profissional == lucas.id_profissional
    ).first()

    if not vinculo:
        vinculo = UbsProfissional(
            id_ubs=ubs.id_ubs,
            id_profissional=lucas.id_profissional,
            permissoes={"is_gestor_local": True, "can_create_escala": True}
        )
        db.add(vinculo)
        db.commit()
        print("🔧 Vínculo criado! Dr. Lucas agora é Gestor Local da UBS.\n")
    
    id_ubs_real = str(ubs.id_ubs)
    db.close()

    # ==========================================
    # 2. FAZER LOGIN E OBTER TOKEN
    # ==========================================
    print("🔐 Fazendo login para obter o Token JWT...")
    login_data = {"username": "11122233344", "password": "admin123"}
    resp_login = requests.post("http://127.0.0.1:8000/auth/login", data=login_data)
    
    if resp_login.status_code != 200:
        print(f"❌ Falha no login: {resp_login.text}")
        return
        
    token = resp_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login efetuado com sucesso!\n")

    # ==========================================
    # 3. TESTE DE SUCESSO (Caminho Feliz)
    # ==========================================
    print("🧪 TESTE 1: Criar recepcionista na mesma UBS do Gestor...")
    payload_sucesso = {
        "nome": "Maria Recepcionista",
        "cpf": "12312312312",
        "senha": "senha_segura",
        "id_ubs": id_ubs_real # Mandando a UBS correta
    }
    
    resp_sucesso = requests.post(
        "http://127.0.0.1:8000/profissionais/", 
        json=payload_sucesso, 
        headers=headers
    )
    
    if resp_sucesso.status_code == 200:
        print("✅ PASSOU! Usuário criado com sucesso no banco de dados.")
    elif resp_sucesso.status_code == 409:
         print("⚠️ PASSOU (Parcial)! A API bloqueou porque o CPF já existia no banco.")
    else:
        print(f"❌ FALHOU: {resp_sucesso.status_code} - {resp_sucesso.text}")

    print("\n------------------------------------------------------\n")

    # ==========================================
    # 4. TESTE DE BLOQUEIO (Prevenção de Invasão)
    # ==========================================
    print("🧪 TESTE 2: Tentar criar recepcionista em uma UBS diferente (Hacker)...")
    payload_hacker = {
        "nome": "João Invasor",
        "cpf": "00000000000",
        "senha": "senha_hacker",
        "id_ubs": "00000000-0000-0000-0000-000000000000" # UUID Falso/De outra UBS
    }
    
    resp_hacker = requests.post(
        "http://127.0.0.1:8000/profissionais/", 
        json=payload_hacker, 
        headers=headers
    )
    
    if resp_hacker.status_code == 403:
        print(f"🛡️ PASSOU! A API bloqueou a invasão com sucesso: {resp_hacker.json()['detail']}")
    else:
        print(f"❌ FALHOU (Brecha de Segurança): API retornou {resp_hacker.status_code}")

if __name__ == "__main__":
    preparar_banco_e_testar()