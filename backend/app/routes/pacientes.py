from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, and_
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..services.cadsus_service import CADSUSService
from ..core.security import get_usuario_logado, gerar_hash # Adicionado gerar_hash
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pacientes", tags=["Pacientes"])
cadsus = CADSUSService()

# ==========================================
# SCHEMAS ADICIONAIS
# ==========================================
class CadastroManualPaciente(BaseModel):
    id_municipio: str
    id_ubs_referencia: Optional[str] = None
    nr_cpf: Optional[str] = Field(None, min_length=11, max_length=11)
    nr_cns: Optional[str] = None
    nm_paciente: str = Field(..., min_length=3)
    nm_mae: Optional[str] = None
    dt_nascimento: date
    tp_sexo: str = Field(..., pattern="^[MFI]$")
    celular: Optional[str] = None
    aceitou_lgpd: bool

class PacienteUpdate(BaseModel):
    """Schema para edição e reset de senha"""
    nm_paciente: Optional[str] = None
    celular: Optional[str] = None
    id_ubs_referencia: Optional[uuid.UUID] = None
    sn_ativo: Optional[bool] = None
    nova_senha: Optional[str] = None # Se enviado, gera o hash e marca provisória

# ==========================================
# ROTA: LISTAR PACIENTES (Gestão Multi-tenant)
# ==========================================
@router.get("/", response_model=List[schemas.PacienteResponse])
async def listar_pacientes(
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Lista cidadãos da prefeitura do usuário logado.
    """
    tenant_id = usuario.get("tenant_id")
    
    stmt = select(models.Paciente).where(models.Paciente.id_municipio == tenant_id)
    result = await db.execute(stmt)
    return result.scalars().all()

# ==========================================
# ROTA: EDITAR / RESET DE SENHA (Gestão)
# ==========================================
@router.put("/{id_paciente}")
async def editar_paciente(
    id_paciente: uuid.UUID,
    payload: PacienteUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Edita dados e permite reset de senha (gera hash e seta flag provisória).
    """
    tenant_id = usuario.get("tenant_id")

    stmt = select(models.Paciente).where(
        and_(
            models.Paciente.id_paciente == id_paciente,
            models.Paciente.id_municipio == tenant_id
        )
    )
    paciente = (await db.execute(stmt)).scalar_one_or_none()

    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado nesta prefeitura.")

    update_data = payload.dict(exclude_unset=True)

    # Lógica de Reset de Senha
    if "nova_senha" in update_data:
        senha_limpa = update_data.pop("nova_senha")
        paciente.senha_hash = gerar_hash(senha_limpa)
        paciente.is_senha_provisoria = True
        paciente.dt_ultimo_reset = datetime.now()

    # Atualiza demais campos (nm_paciente, celular, etc)
    for key, value in update_data.items():
        if key == "celular":
            paciente.contato = {"celular": value}
        else:
            setattr(paciente, key, value)

    try:
        await db.commit()
        return {"msg": "Cidadão atualizado!", "id": id_paciente}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# SCHEMA DE CADASTRO MANUAL (fallback CADSUS)
# ==========================================
class CadastroManualPaciente(BaseModel):
    id_municipio: str
    id_ubs_referencia: Optional[str] = None
    nr_cpf: Optional[str] = Field(None, min_length=11, max_length=11)
    nr_cns: Optional[str] = None
    nm_paciente: str = Field(..., min_length=3)
    nm_mae: Optional[str] = None
    dt_nascimento: date
    tp_sexo: str = Field(..., pattern="^[MFI]$")
    celular: Optional[str] = None
    aceitou_lgpd: bool


# ==========================================
# ROTA 1: CADASTRO VIA CADSUS (automático)
# ==========================================
@router.post("/validar-cadsus/{cpf}")
async def validar_e_cadastrar_paciente(
    cpf: str, 
    dados: schemas.CadastroPacienteApp, 
    db: AsyncSession = Depends(get_db)
):
    """
    Valida o CPF na base do CADSUS e cadastra o paciente automaticamente.
    Se o CADSUS estiver indisponível, retorna status 503 orientando uso do cadastro manual.
    """
    try:
        if not dados.aceitou_lgpd: 
            raise HTTPException(status_code=403, detail="Aceite LGPD obrigatório para o cadastro.")
        
        # Verificar se já está cadastrado neste município
        stmt = select(models.Paciente).where(
            and_(
                models.Paciente.nr_cpf == cpf,
                models.Paciente.id_municipio == dados.id_municipio
            )
        )
        existente = (await db.execute(stmt)).scalar_one_or_none()
        
        if existente: 
            return {
                "msg": "Paciente já cadastrado nesta prefeitura.",
                "id_paciente": str(existente.id_paciente),
                "nome": existente.nm_paciente,
                "ja_existia": True
            }

        # Consultar CADSUS
        dados_gov = cadsus.consultar_por_cpf(cpf)
        if not dados_gov: 
            raise HTTPException(
                status_code=503,
                detail="CPF não encontrado na base federal (CADSUS). Use o cadastro manual para registrar o cidadão."
            )
        
        # Inserir paciente com dados do CADSUS
        novo = models.Paciente(
            id_municipio=dados.id_municipio, 
            id_ubs_referencia=dados.id_ubs_referencia,
            nr_cpf=cpf, 
            nr_cns=dados_gov.cns, 
            nm_paciente=dados_gov.nome,
            dt_nascimento=dados_gov.dataNascimento.date() if isinstance(dados_gov.dataNascimento, datetime) else dados_gov.dataNascimento,
            tp_sexo="I",
            contato={"celular": dados.celular}, 
            is_validado_sus=True,
            dt_aceite_lgpd=datetime.now() 
        )
        db.add(novo)
        await db.commit()
        await db.refresh(novo)
        
        return {
            "msg": f"Cidadão registrado com sucesso via CADSUS! Bem-vindo, {dados_gov.nome}.",
            "id_paciente": str(novo.id_paciente),
            "nome": dados_gov.nome,
            "ja_existia": False
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Erro no cadastro CADSUS")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# ROTA 2: CADASTRO MANUAL (fallback)
# ==========================================
@router.post("/cadastro-manual", status_code=status.HTTP_201_CREATED)
async def cadastro_manual_paciente(
    dados: CadastroManualPaciente,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Cadastro manual de paciente sem dependência do CADSUS.
    Usado quando o CADSUS está fora ou o cidadão não tem CPF.
    O paciente fica marcado como is_validado_sus=False até validação futura.
    """
    import uuid as uuid_lib
    
    tenant_id = usuario.get("tenant_id")
    
    if not dados.aceitou_lgpd:
        raise HTTPException(status_code=403, detail="Aceite LGPD obrigatório para o cadastro.")
    
    if not dados.nr_cpf and not dados.nr_cns:
        raise HTTPException(status_code=422, detail="Informe pelo menos CPF ou Cartão Nacional de Saúde (CNS).")
    
    # Verificar duplicata por CPF neste município
    if dados.nr_cpf:
        stmt_dup = select(models.Paciente).where(
            and_(
                models.Paciente.nr_cpf == dados.nr_cpf,
                models.Paciente.id_municipio == dados.id_municipio
            )
        )
        if (await db.execute(stmt_dup)).scalar_one_or_none():
            raise HTTPException(status_code=409, detail="CPF já cadastrado neste município.")
    
    try:
        id_ubs = uuid_lib.UUID(dados.id_ubs_referencia) if dados.id_ubs_referencia else None
        id_mun = uuid_lib.UUID(dados.id_municipio)
    except ValueError:
        raise HTTPException(status_code=400, detail="IDs inválidos informados.")
    
    novo = models.Paciente(
        id_municipio=id_mun,
        id_ubs_referencia=id_ubs,
        nr_cpf=dados.nr_cpf,
        nr_cns=dados.nr_cns,
        nm_paciente=dados.nm_paciente,
        nm_mae=dados.nm_mae,
        dt_nascimento=dados.dt_nascimento,
        tp_sexo=dados.tp_sexo,
        contato={"celular": dados.celular} if dados.celular else {},
        is_validado_sus=False,  # Marcado como não validado pelo SUS
        dt_aceite_lgpd=datetime.now()
    )
    db.add(novo)
    
    try:
        await db.commit()
        await db.refresh(novo)
    except Exception as e:
        await db.rollback()
        logger.exception("Erro no cadastro manual")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {
        "msg": f"Cidadão '{novo.nm_paciente}' cadastrado manualmente com sucesso!",
        "id_paciente": str(novo.id_paciente),
        "nome": novo.nm_paciente,
        "is_validado_sus": False,
        "aviso": "Cadastro pendente de validação pelo CADSUS. Lembre-se de validar o CNS futuramente."
    }


# ==========================================
# ROTA 3: DESBLOQUEAR PACIENTE (por absenteísmo)
# ==========================================
@router.patch("/{id_paciente}/desbloquear", status_code=status.HTTP_200_OK)
async def desbloquear_paciente(
    id_paciente: str, 
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Desbloqueia um paciente convertendo suas Faltas ('F') em Faltas Justificadas ('FJ').
    """
    tenant_id = usuario.get("tenant_id")

    stmt_paciente = select(models.Paciente.id_paciente).filter_by(
        id_paciente=id_paciente, 
        id_municipio=tenant_id
    )
    if not (await db.execute(stmt_paciente)).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Acesso negado a este utente.")

    query_desbloqueio = (
        update(models.ItAgendaCentral)
        .where(
            and_(
                models.ItAgendaCentral.id_paciente == id_paciente,
                models.ItAgendaCentral.tp_situacao == 'F',
                models.ItAgendaCentral.id_municipio == tenant_id
            )
        )
        .values(tp_situacao='FJ') 
    )
    
    result = await db.execute(query_desbloqueio)
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Nenhuma falta pendente encontrada para justificar neste paciente."
        )

    return {
        "mensagem": f"Paciente desbloqueado com sucesso! {result.rowcount} falta(s) perdoada(s) pela UBS.",
        "executor": usuario.get("sub")
    }