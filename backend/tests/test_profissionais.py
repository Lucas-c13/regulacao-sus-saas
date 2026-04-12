import pytest
from httpx import Client
import uuid

def get_admin_token(client: Client):
    resp_acessos = client.post("/auth/verificar-acessos", json={"cpf": "11122233344"})
    id_municipio = resp_acessos.json()["vinculos"][0]["id_municipio"]
    login_data = {
        "username": "11122233344", "password": "admin123", "client_id": id_municipio
    }
    response = client.post("/auth/login", data=login_data)
    return response.json()["access_token"]

def test_08_crud_profissional_gestor(client: Client):
    """
    Testa a criação de um Gestor Local (Nível 2 -> Nível 3 Delegado)
    e a listagem na Mesa de Controle.
    """
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Pega uma UBS existente
    resp_ubs = client.get("/ubs/", headers=headers)
    id_ubs = resp_ubs.json()[0]["id_ubs"]
    
    # 2. CREATE GESTOR LOCAL
    cpf_novo = str(uuid.uuid4().int)[:11]
    gestor_data = {
        "nome": "Gestor de Teste Scancode",
        "cpf": cpf_novo,
        "senha": "senha_mestra_123",
        "id_ubs": id_ubs
    }
    
    resp_create = client.post("/profissionais/gestor-local", json=gestor_data, headers=headers)
    assert resp_create.status_code == 201
    id_prof = resp_create.json()["id_profissional"]
    
    # 3. READ (Mesa de Controle)
    resp_list = client.get("/profissionais/municipio", headers=headers)
    assert resp_list.status_code == 200
    lista = resp_list.json()
    
    encontrado = any(p["id_profissional"] == id_prof for p in lista)
    assert encontrado is True
    
    novo_p = next(p for p in lista if p["id_profissional"] == id_prof)
    assert novo_p["nome"] == "Gestor de Teste Scancode"
    assert novo_p["cpf"] == cpf_novo

def test_09_erro_cpf_duplicado_profissional(client: Client):
    """
    Garante que não se pode cadastrar o mesmo CPF duas vezes no mesmo município.
    """
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    resp_ubs = client.get("/ubs/", headers=headers)
    id_ubs = resp_ubs.json()[0]["id_ubs"]
    
    cpf_repetido = "99988877700"
    data = {"nome": "Doutor 1", "cpf": cpf_repetido, "senha": "password123", "id_ubs": id_ubs}
    
    # Primeiro Cadastro
    client.post("/profissionais/gestor-local", json=data, headers=headers)
    
    # Segundo Cadastro (Falha 409)
    resp_fail = client.post("/profissionais/gestor-local", json=data, headers=headers)
    assert resp_fail.status_code == 409
