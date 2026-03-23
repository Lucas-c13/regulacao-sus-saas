import requests

# Em vez de pd.read_excel...
response = requests.get("http://127.0.0.1:8000/solicitacoes/pendentes")
pacientes_a_processar = response.json()

for paciente in pacientes_a_processar:
    print(f"Processando: {paciente['paciente_nome']}")
    # O robô agora usa os dados vindos da API:
    # navegador.find_element(...).send_keys(paciente['paciente_nome'])