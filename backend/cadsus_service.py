from datetime import datetime
import time

# Classe para simular a resposta do Ministério da Saúde
class MockDadosGoverno:
    def __init__(self, nome, cns, data_nasc):
        self.nome = nome
        self.cns = cns
        self.dataNascimento = data_nasc

class CADSUSService:
    def __init__(self):
        # No simulador, não precisamos carregar certificados
        print("⚠️  Serviço CADSUS iniciado em MODO SIMULAÇÃO (Mock)")

    def consultar_por_cpf(self, cpf: str):
        """
        Simula a busca na base federal. 
        Retorna dados apenas para estes dois CPFs de teste.
        """
        base_teste = {
            "12345678901": MockDadosGoverno("MARIA DA SILVA MOCK", "700012345678901", datetime(1985, 10, 15)),
            "98765432100": MockDadosGoverno("JOSE DOS SANTOS MOCK", "700098765432100", datetime(1970, 3, 12))
        }

        # Simula o tempo de resposta do servidor do governo
        time.sleep(0.8) 

        return base_teste.get(cpf)