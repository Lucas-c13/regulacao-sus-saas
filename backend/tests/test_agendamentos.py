import pytest
from httpx import Client

def test_04_bloqueio_rota_anonima(client: Client):
    """
    Testa se o sistema bloqueia utilizadores que consigam o link direto 
    (sem JWT Bearer Token).
    """
    response = client.get("/agendamentos/minha-agenda")
    assert response.status_code == 401

def test_05_minha_agenda_autorizada(client: Client):
    """
    Testa o motor de Agendamento listando a agenda vazia limpa para o Admin Master,
    garantindo que RBAC está a fluir para rotas internas.
    """
    # 1. Obter Tenant
    resp_acessos = client.post("/auth/verificar-acessos", json={"cpf": "11122233344"})
    id_municipio = resp_acessos.json()["vinculos"][0]["id_municipio"]

    # 2. Login
    login_data = {
        "username": "11122233344",
        "password": "admin123",
        "client_id": id_municipio
    }
    resp_login = client.post("/auth/login", data=login_data)
    token = resp_login.json()["access_token"]
    id_ubs = resp_login.json()["usuario"]["id_ubs"]

    # 3. GET /agendamentos/minha-agenda injetando Token
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get(f"/agendamentos/minha-agenda?id_ubs={id_ubs}", headers=headers)
    
    assert response.status_code == 200
    dados = response.json()
    assert "pacientes" in dados
    assert type(dados["pacientes"]) is list
