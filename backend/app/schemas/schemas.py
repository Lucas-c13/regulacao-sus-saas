from pydantic import BaseModel, field_validator, Field
from datetime import date, time, datetime 
from typing import Optional

class CadastroPacienteApp(BaseModel):
    id_municipio: str
    id_ubs_referencia: str
    celular: str
    aceitou_lgpd: bool
    dt_aceite_lgpd: Optional[datetime] = None

    @field_validator('dt_aceite_lgpd')
    @classmethod
    def valida_lgpd(cls, v):
        if not v:
            # Rejeita imediatamente a requisição com Erro 422 (Unprocessable Entity)
            raise ValueError('A data de aceite do Termo de Consentimento (LGPD) é obrigatória para o registro no App.')
        return v
    
    @field_validator('aceitou_lgpd')
    @classmethod
    def valida_booleano_lgpd(cls, v):
        if v is not True:
            raise ValueError('Você deve aceitar os termos da LGPD para continuar.')
        return v

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

class EscalaCentralBase(BaseModel):
    id_ubs: str
    id_profissional: str
    hr_inicio: time = Field(..., description="Hora de início do turno (ex: 08:00)")
    hr_fim: time = Field(..., description="Hora de fim do turno (ex: 17:00)")
    tempo_medio_min: int = Field(..., gt=0, description="Duração de cada consulta em minutos (ex: 15)")
    is_disponivel_app: bool = Field(default=True, description="Se a vaga vai para a App ou fica exclusiva na receção")

class EscalaCentralCreate(EscalaCentralBase):
    pass

class EscalaCentralResponse(EscalaCentralBase):
    id_escala: str
    id_municipio: str
    sn_ativo: bool

    class Config:
        from_attributes = True