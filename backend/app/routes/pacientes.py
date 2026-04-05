from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, and_
from datetime import datetime, timezone

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..services.cadsus_service import CADSUSService
from ..core.security import get_usuario_logado

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])
cadsus = CADSUSService()

@router.post("/validar-cadsus/{cpf}")
async def validar_e_cadastrar_paciente(
    cpf: str, 
    dados: schemas.CadastroPacienteApp, 
    db: AsyncSession = Depends(get_db)
):
    # 1. Trava da LGPD (Segurança extra caso falhe na validação do Pydantic)
    if not dados.aceitou_lgpd: 
        raise HTTPException(status_code=403, detail="Aceite LGPD obrigatório para o cadastro.")
    
    # 2. Mock do CADSUS
    dados_gov = cadsus.consultar_por_cpf(cpf)
    if not dados_gov: 
        raise HTTPException(status_code=502, detail="Serviço CADSUS indisponível no momento.")
    
    # 3. Busca assíncrona (Isolando por Município)
    # Garante que verificamos se o CPF existe NAQUELA prefeitura específica
    stmt = select(models.Paciente).where(
        and_(
            models.Paciente.nr_cpf == cpf,
            models.Paciente.id_municipio == dados.id_municipio
        )
    )
    result = await db.execute(stmt)
    existente = result.scalar_one_or_none()
    
    if existente: 
        return {"msg": "Paciente já cadastrado nesta prefeitura.", "nome": existente.nm_paciente}

    # 4. Inserção assíncrona
    novo = models.Paciente(
        id_municipio=dados.id_municipio, 
        id_ubs_referencia=dados.id_ubs_referencia,
        nr_cpf=cpf, 
        nr_cns=dados_gov.cns, 
        nm_paciente=dados_gov.nome,
        dt_nascimento=dados_gov.dataNascimento, # Assegure-se que dados_gov retorna um objeto datetime.date
        tp_sexo="I",
        contato={"celular": dados.celular}, 
        is_validado_sus=True,
        dt_aceite_lgpd=datetime.now(timezone.utc) 
    )
    db.add(novo)
    
    try:
        await db.commit()
        await db.refresh(novo)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar paciente: {str(e)}")
    
    return {"msg": "Paciente registrado com sucesso!", "id_paciente": str(novo.id_paciente)}


@router.patch("/{id_paciente}/desbloquear", status_code=status.HTTP_200_OK)
async def desbloquear_paciente(
    id_paciente: str, 
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado) # <-- Blindagem Sênior: Exige token de funcionário!
):
    """
    Desbloqueia um paciente convertendo suas Faltas ('F') em Faltas Justificadas ('FJ').
    Isso zera a contagem de absenteísmo sem apagar o histórico do banco.
    """
    tenant_id = usuario.get("tenant_id")

    # 1. Segurança: Validar se o paciente pertence ao município do recepcionista
    stmt_paciente = select(models.Paciente.id_paciente).filter_by(
        id_paciente=id_paciente, 
        id_municipio=tenant_id
    )
    if not (await db.execute(stmt_paciente)).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Acesso negado a este utente.")

    # 2. Executa um UPDATE em massa alinhado com a modelagem do ItAgendaCentral
    query_desbloqueio = (
        update(models.ItAgendaCentral)
        .where(
            and_(
                models.ItAgendaCentral.id_paciente == id_paciente,
                models.ItAgendaCentral.tp_situacao == 'F',
                models.ItAgendaCentral.id_municipio == tenant_id # Escudo Anti-Vazamento
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