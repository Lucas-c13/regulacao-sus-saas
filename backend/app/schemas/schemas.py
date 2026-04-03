from pydantic import BaseModel
from datetime import date, time

class CadastroPacienteApp(BaseModel):
    id_municipio: str
    id_ubs_referencia: str
    celular: str
    aceitou_lgpd: bool

class NovoAgendamentoApp(BaseModel):
    id_paciente: str
    id_escala: str
    data_agendamento: date
    hora_vaga: time

class AtualizaStatusAgendamento(BaseModel):
    novo_status: str
    
class NovoProfissionalUBS(BaseModel):
    nome: str
    cpf: str
    senha: str
    id_ubs: str # A UBS para onde o novo funcionário vai ser designado