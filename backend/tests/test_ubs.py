import pytest
from httpx import Client
import uuid

def get_admin_token(client: Client):
    # 1. Pega o ID do município
    resp_acessos = client.post("/auth/verificar-acessos", json={"cpf": "11122233344"})
    id_municipio = resp_acessos.json()["vinculos"][0]["id_municipio"]

    # 2. Login
    login_data = {
        "username": "11122233344",
        "password": "admin123",
        "client_id": id_municipio
    }
    response = client.post("/auth/login", data=login_data)
    return response.json()["access_token"]

def test_06_crud_ubs_completo(client: Client):
    """
    Testa o fluxo CRUD completo de uma UBS:
    C: Criar UBS (Gestor Master fingindo ser Gestor de Prefeitura)
    R: Listar UBS e ver se ela aparece
    U: (O backend ainda não tem Rota de Update específica, apenas listamos)
    D: (Inativação não implementada, testamos a consistência)
    """
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. CREATE
    cnes_teste = str(uuid.uuid4())[:7] # CNES aleatório para evitar conflito
    nova_ubs_data = {
        "nome": "UBS TESTE SCANCODE",
        "cnes": cnes_teste,
        "cep": "01001000", # São Paulo
        "endereco": "Endereço Provisório" # O backend vai sobrescrever com ViaCEP
    }
    
    resp_create = client.post("/ubs/", json=nova_ubs_data, headers=headers)
    assert resp_create.status_code == 201
    id_ubs = resp_create.json()["id_ubs"]
    
    # 2. READ (Listagem Geral do Município)
    resp_list = client.get("/ubs/", headers=headers)
    assert resp_list.status_code == 200
    lista = resp_list.json()
    
    # Verifica se a UBS criada está na lista
    encontrada = any(u["id_ubs"] == id_ubs for u in lista)
    assert encontrada is True
    
    # Verifica se o endereço foi padronizado pelo ViaCEP
    ubs_especifica = next(u for u in lista if u["id_ubs"] == id_ubs)
    assert ubs_especifica["nome_ubs"] == "UBS TESTE SCANCODE"
    assert ubs_especifica["cnes"] == cnes_teste

def test_07_erro_cnes_duplicado(client: Client):
    """
    Garante que o backend bloqueia a criação de duas UBS com o mesmo CNES.
    """
    token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    
    cnes_duplo = "1234567"
    data = {
        "nome": "UBS DUPLICADA 1",
        "cnes": cnes_duplo,
        "cep": "01001000",
        "endereco": "Rua Teste de Scancode, 123"
    }
    
    # Primeiro sucesso (ou já existe)
    client.post("/ubs/", json=data, headers=headers)
    
    # Segundo deve falhar (409 Conflict)
    resp_fail = client.post("/ubs/", json=data, headers=headers)
    assert resp_fail.status_code == 409
    assert "CNES" in resp_fail.json()["detail"]
