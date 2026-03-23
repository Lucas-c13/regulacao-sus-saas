import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

class Cliente(Base):
    __tablename__ = "clientes"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nome_municipio: Mapped[str] = mapped_column(String(150))
    cnpj: Mapped[str] = mapped_column(String(14), unique=True)
    sisreg_login: Mapped[Optional[str]] = mapped_column(String(50))

class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"))
    cpf: Mapped[Optional[str]] = mapped_column(String(11), unique=True)
    nome_completo: Mapped[str] = mapped_column(String(150))
    cns: Mapped[Optional[str]] = mapped_column(String(15))
    endereco_completo: Mapped[str] = mapped_column(String(255))
    telefone: Mapped[Optional[str]] = mapped_column(String(15))
    email: Mapped[str] = mapped_column(String(100))
    matricula: Mapped[str] = mapped_column(String(50))
    tipo: Mapped[str] = mapped_column(String(20)) # Próprio ou Terceirizado
    nome_mae: Mapped[str] = mapped_column(String(150))

class Medico(Base):
    __tablename__ = "medicos"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"))
    nome_completo: Mapped[str] = mapped_column(String(150))
    crm: Mapped[str] = mapped_column(String(20))
    cpf: Mapped[str] = mapped_column(String(11))
    especialidade: Mapped[str] = mapped_column(String(100))
    telefone: Mapped[str] = mapped_column(String(15))
    email: Mapped[str] = mapped_column(String(100))

class UBS(Base):
    __tablename__ = "unidades_saude"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"))
    nome: Mapped[str] = mapped_column(String(150))
    cnes: Mapped[str] = mapped_column(String(20))
    responsavel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"))
    email: Mapped[str] = mapped_column(String(100))
    telefone: Mapped[str] = mapped_column(String(15))

class Fila(Base):
    __tablename__ = "filas"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"))
    especialidade: Mapped[str] = mapped_column(String(100))
    tipo: Mapped[str] = mapped_column(String(20)) # Consulta ou Exame

class Prestador(Base):
    __tablename__ = "prestadores"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"))
    nome: Mapped[str] = mapped_column(String(150))
    cnpj: Mapped[str] = mapped_column(String(14))
    tipo: Mapped[str] = mapped_column(String(20)) # Próprio ou Terceirizado

class Solicitacao(Base):
    __tablename__ = "solicitacoes"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clientes.id"))
    paciente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pacientes.id"))
    medico_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("medicos.id"))
    ubs_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("unidades_saude.id"))
    fila_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("filas.id"))
    
    status: Mapped[str] = mapped_column(String(30), default="AGUARDANDO_ROBO")
    prioridade: Mapped[str] = mapped_column(String(20)) # Leve, Moderado
    justificativa: Mapped[str] = mapped_column(Text) # Até 4000 caracteres
    
    # Caminhos dos arquivos (Anexos)
    anexo_1: Mapped[Optional[str]] = mapped_column(String(255))
    anexo_2: Mapped[Optional[str]] = mapped_column(String(255))
    
    data_criacao: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    protocolo_sisreg: Mapped[Optional[str]] = mapped_column(String(50))

    # Relacionamentos
    paciente = relationship("Paciente")