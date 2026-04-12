import pytest
from httpx import Client
import uuid
from datetime import datetime

def get_admin_token(client: Client):
    resp_acessos = client.post("/auth/verificar-acessos", json={"cpf": "11122233344"})
    id_municipio = resp_acessos.json()["vinculos"][0]["id_municipio"]
    login_data = {"username": "11122233344", "password": "admin123", "client_id": id_municipio}
    response = client.post("/auth/login", data=login_data)
    return response.json()["access_token"], id_municipio

def test_11_crud_paciente_cadsus(client: Client):
    """
    Testa a validação e cadastro de paciente via CADSUS Mock.
    """
    token, id_mun = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Pega uma UBS para referência
    resp_ubs = client.get("/ubs/", headers=headers)
    id_ubs = resp_ubs.json()[0]["id_ubs"]
    
    # 2. VALIDAR E CADASTRAR VIA CADSUS (CPF Mockado)
    cpf_teste = "12345678901"
    paciente_data = {
        "id_municipio": id_mun,
        "id_ubs_referencia": id_ubs,
        "cpf": cpf_teste,
        "celular": "11988887777",
        "aceitou_lgpd": True,
        "dt_aceite_lgpd": datetime.now().isoformat()
    }
    
    resp_create = client.post(f"/pacientes/validar-cadsus/{cpf_teste}", json=paciente_data)
    assert resp_create.status_code == 200
    assert "sucesso" in resp_create.json()["msg"]
    assert "id_paciente" in resp_create.json()
