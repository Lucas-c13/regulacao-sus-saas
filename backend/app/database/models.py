import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Date, Time, Boolean, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from .session import Base

# ==========================================
# 1. CORE MULTI-TENANT E ACESSOS
# ==========================================

class Municipio(Base):
    __tablename__ = "municipios"
    id_municipio: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    ibge: Mapped[str] = mapped_column(String(7), unique=True)
    nome: Mapped[str] = mapped_column(String(150))
    # Configurações JSONB (ex: {"faltas_limite": 3, "dias_bloqueio": 30})
    config_absenteismo: Mapped[Optional[dict]] = mapped_column(JSONB)
    tema_visual: Mapped[Optional[dict]] = mapped_column(JSONB)
    dt_cadastro: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

class UBS(Base):
    __tablename__ = "unidades_saude"
    id_ubs: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    id_municipio: Mapped[uuid.UUID] = mapped_column(ForeignKey("municipios.id_municipio"))
    nome: Mapped[str] = mapped_column(String(150))
    cnes: Mapped[str] = mapped_column(String(20))
    cep: Mapped[str] = mapped_column(String(8))
    endereco: Mapped[str] = mapped_column(String(255))
    dt_cadastro: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

class Profissional(Base):
    __tablename__ = "profissionais"
    id_profissional: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    id_municipio: Mapped[uuid.UUID] = mapped_column(ForeignKey("municipios.id_municipio"))
    nome: Mapped[str] = mapped_column(String(150))
    cpf: Mapped[str] = mapped_column(String(11))
    conselho: Mapped[Optional[str]] = mapped_column(String(50)) # CRM/COREN
    senha_hash: Mapped[str] = mapped_column(String(255))
    sn_ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    dt_cadastro: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Garante que o CPF é único dentro do mesmo município
    __table_args__ = (UniqueConstraint('id_municipio', 'cpf', name='uix_municipio_cpf'),)

class UbsProfissional(Base):
    """Tabela Auxiliar + ACL (Controlo de Permissões Granulares em JSONB)"""
    __tablename__ = "aux_ubs_profissionais"
    id_ubs: Mapped[uuid.UUID] = mapped_column(ForeignKey("unidades_saude.id_ubs"), primary_key=True)
    id_profissional: Mapped[uuid.UUID] = mapped_column(ForeignKey("profissionais.id_profissional"), primary_key=True)
    # Permissões JSONB (ex: {"is_gestor_local": true, "can_create_escala": true})
    permissoes: Mapped[Optional[dict]] = mapped_column(JSONB)

class Especialidade(Base):
    __tablename__ = "especialidades"
    id_especialidade: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100))
    is_livre_demanda: Mapped[bool] = mapped_column(Boolean, default=False)

class EspecialidadeProfissional(Base):
    __tablename__ = "aux_especialidade_profissionais"
    id_profissional: Mapped[uuid.UUID] = mapped_column(ForeignKey("profissionais.id_profissional"), primary_key=True)
    id_especialidade: Mapped[uuid.UUID] = mapped_column(ForeignKey("especialidades.id_especialidade"), primary_key=True)

# ==========================================
# 2. PACIENTES E CAD SUS
# ==========================================

class Paciente(Base):
    __tablename__ = "pacientes"
    id_paciente: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    id_municipio: Mapped[uuid.UUID] = mapped_column(ForeignKey("municipios.id_municipio"))
    id_ubs_referencia: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("unidades_saude.id_ubs"))
    nr_cpf: Mapped[Optional[str]] = mapped_column(String(11))
    nr_cns: Mapped[Optional[str]] = mapped_column(String(15))
    nm_paciente: Mapped[str] = mapped_column(String(150))
    nm_mae: Mapped[Optional[str]] = mapped_column(String(150))
    dt_nascimento: Mapped[datetime] = mapped_column(Date)
    tp_sexo: Mapped[str] = mapped_column(String(1))
    contato: Mapped[Optional[dict]] = mapped_column(JSONB) # Ex: {"celular": "999999999"}
    sn_ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    is_validado_sus: Mapped[bool] = mapped_column(Boolean, default=False)
    dt_aceite_lgpd: Mapped[datetime] = mapped_column(DateTime) # Obrigatório (Não Nulo)
    dt_cadastro: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

# ==========================================
# 3. MOTOR DE AGENDAMENTO (CORE)
# ==========================================

class EscalaCentral(Base):
    """O Molde da Escala"""
    __tablename__ = "escala_central"
    id_escala: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    id_ubs: Mapped[uuid.UUID] = mapped_column(ForeignKey("unidades_saude.id_ubs"))
    id_profissional: Mapped[uuid.UUID] = mapped_column(ForeignKey("profissionais.id_profissional"))
    id_especialidade: Mapped[uuid.UUID] = mapped_column(ForeignKey("especialidades.id_especialidade"))
    tp_dia_semana: Mapped[int] = mapped_column(Integer) # 1 (Segunda) a 7 (Domingo)
    hr_inicio: Mapped[datetime] = mapped_column(Time)
    hr_fim: Mapped[datetime] = mapped_column(Time)
    qt_atendimento: Mapped[int] = mapped_column(Integer)
    tempo_medio_min: Mapped[int] = mapped_column(Integer) # Essencial para fatiar os slots

class AgendaCentral(Base):
    """O Dia Gerado a partir do Molde"""
    __tablename__ = "agenda_central"
    id_agenda: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    id_escala: Mapped[uuid.UUID] = mapped_column(ForeignKey("escala_central.id_escala"))
    dt_agenda: Mapped[datetime] = mapped_column(Date)
    sn_ativo: Mapped[bool] = mapped_column(Boolean, default=True)

class ItAgendaCentral(Base):
    """O Slot / Agendamento Específico"""
    __tablename__ = "it_agenda_central"
    id_item: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    id_agenda: Mapped[uuid.UUID] = mapped_column(ForeignKey("agenda_central.id_agenda"))
    hr_agenda: Mapped[datetime] = mapped_column(Time)
    # Paciente é nulo até alguém agendar o slot
    id_paciente: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("pacientes.id_paciente"))
    sn_encaixe: Mapped[bool] = mapped_column(Boolean, default=False)
    # tp_situacao: 'M'(Marcado), 'A'(Chegou), 'F'(Faltou), 'C'(Cancelado)
    tp_situacao: Mapped[Optional[str]] = mapped_column(String(1))