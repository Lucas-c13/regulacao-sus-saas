import pytest
from httpx import Client
import uuid
from datetime import time

def get_admin_token(client: Client):
    resp_acessos = client.post("/auth/verificar-acessos", json={"cpf": "11122233344"})
    id_municipio = resp_acessos.json()["vinculos"][0]["id_municipio"]
    login_data = {"username": "11122233344", "password": "admin123", "client_id": id_municipio}
    response = client.post("/auth/login", data=login_data)
    return response.json()["access_token"]

def test_10_crud_escala_completo(client: Client):
    """
    Testa a criação de uma Escala e a sua listagem.
    """
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Recuperar IDs necessários (UBS, Profissional, Especialidade)
    resp_ubs = client.get("/ubs/", headers=headers)
    id_ubs = resp_ubs.json()[0]["id_ubs"]
    
    resp_prof = client.get("/profissionais/municipio", headers=headers)
    id_prof = resp_prof.json()[0]["id_profissional"]
    
    resp_esp = client.get("/especialidades/", headers=headers)
    id_esp = resp_esp.json()[0]["id_especialidade"]
    
    # 2. CREATE ESCALA
    escala_data = {
        "id_ubs": id_ubs,
        "id_profissional": id_prof,
        "id_especialidade": id_esp,
        "tp_dia_semana": 1, # Segunda
        "hr_inicio": "08:00:00",
        "hr_fim": "12:00:00",
        "tempo_medio_min": 20,
        "is_disponivel_app": True
    }
    
    resp_create = client.post("/escalas/", json=escala_data, headers=headers)
    assert resp_create.status_code == 201
    id_escala = resp_create.json()["id_escala"]
    
    # 3. READ (Listagem)
    resp_list = client.get(f"/escalas/?id_ubs={id_ubs}", headers=headers)
    assert resp_list.status_code == 200
    lista = resp_list.json()
    assert any(e["id_escala"] == id_escala for e in lista)
    
    # 4. DELETE (Soft Delete - Desativar)
    resp_del = client.patch(f"/escalas/{id_escala}/desativar", headers=headers)
    assert resp_del.status_code == 200
    
    # Verifica se sumiu da listagem ativa
    resp_list_pos = client.get(f"/escalas/?id_ubs={id_ubs}", headers=headers)
    assert not any(e["id_escala"] == id_escala for e in resp_list_pos.json())
