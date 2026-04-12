import pytest
from httpx import Client

def test_01_verificar_acessos_admin(client: Client):
    """
    Testa se o sistema consegue identificar em qual município o médico/admin 
    trabalha usando o seu CPF.
    """
    response = client.post(
        "/auth/verificar-acessos",
        json={"cpf": "11122233344"}
    )
    assert response.status_code == 200
    dados = response.json()
    assert "vinculos" in dados
    assert len(dados["vinculos"]) > 0

def test_02_login_sucesso_admin(client: Client):
    """
    Testa o fluxo de Login OAuth2 Form Data, pegando primeiro o ID do município 
    e depois validando as credenciais do Master Admin.
    """
    resp_acessos = client.post("/auth/verificar-acessos", json={"cpf": "11122233344"})
    id_municipio = resp_acessos.json()["vinculos"][0]["id_municipio"]

    login_data = {
        "username": "11122233344",
        "password": "admin123",
        "client_id": id_municipio
    }
    
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 200
    val = response.json()
    assert "access_token" in val
    assert val["token_type"] == "bearer"
    assert val["usuario"]["nome"] == "Lucas Silva (Administrador)"

def test_03_login_credenciais_invalidas(client: Client):
    """
    Testa a rejeição robusta em caso de password errada.
    """
    resp_acessos = client.post("/auth/verificar-acessos", json={"cpf": "11122233344"})
    id_municipio = resp_acessos.json()["vinculos"][0]["id_municipio"]

    login_data = {
        "username": "11122233344",
        "password": "senhaerradafake",
        "client_id": id_municipio
    }
    
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 401
    assert "inválidas" in response.json()["detail"].lower()
