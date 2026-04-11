from pydantic import BaseModel, field_validator, Field, model_validator
from datetime import date, time, datetime 
from typing import Optional

class CadastroPacienteApp(BaseModel):
    id_municipio: str
    id_ubs_referencia: str
    cpf: Optional[str] = Field(None, min_length=11, max_length=11)
    cns: Optional[str] = Field(None, min_length=15, max_length=15)
    celular: str
    aceitou_lgpd: bool
    dt_aceite_lgpd: Optional[datetime] = None

    @model_validator(mode='after')
    def valida_documento(self):
        if not self.cpf and not self.cns:
            raise ValueError('Obrigatório informar CPF ou CNS para o agendamento no SUS.')
        return self

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
    registro_conselho: Optional[str] = Field(None, description="CRM, COREN ou afins do profissional")

class EscalaCentralBase(BaseModel):
    id_ubs: str
    id_profissional: str
    cbo: Optional[str] = Field(None, description="CBO (Classificação Brasileira de Ocupações) da especialidade")
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

class RedefinirSenhaRequest(BaseModel):
    senha_atual: str
    nova_senha: str = Field(..., min_length=8)

# ==========================================
# SCHEMAS DE ADMINISTRAÇÃO E TENANT (CORE)
# ==========================================

class ConfigAbsenteismoSchema(BaseModel):
    faltas_limite: int = Field(default=3, description="Número máximo de faltas toleradas")
    dias_bloqueio: int = Field(default=30, description="Dias de suspensão no app")

class TemaVisualSchema(BaseModel):
    color_primary: str = Field(default="#0056b3", description="Cor primária em formato HEX")

class MunicipioCreate(BaseModel):
    """Payload para Nível 1: Gestão de Tenant/Município"""
    ibge: str = Field(..., min_length=7, max_length=7, description="Código IBGE do Município (7 dígitos)")
    nome: str = Field(..., min_length=3, max_length=150)
    config_absenteismo: ConfigAbsenteismoSchema = Field(default_factory=ConfigAbsenteismoSchema)
    tema_visual: TemaVisualSchema = Field(default_factory=TemaVisualSchema)

class UbsCreate(BaseModel):
    """Payload para Nível 2: Cadastro de uma nova UBS no município"""
    nome: str = Field(..., min_length=3, max_length=150)
    cnes: str = Field(..., min_length=7, max_length=20)
    cep: str = Field(..., min_length=8, max_length=8)
    endereco: str = Field(..., min_length=10, max_length=255)

class GestorLocalCreate(BaseModel):
    """Payload para Nível 2: Delegar poderes is_gestor_local a um profissional"""
    nome: str = Field(..., min_length=3, max_length=150)
    cpf: str = Field(..., min_length=11, max_length=11)
    senha: str = Field(..., min_length=8)
    id_ubs: str = Field(..., description="UUID da UBS que será gerida por este profissional")