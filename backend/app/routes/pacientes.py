from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from datetime import datetime, timezone

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..services.cadsus_service import CADSUSService
from app.core.security import get_tenant_db

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])
cadsus = CADSUSService()

@router.post("/validar-cadsus/{cpf}")
async def validar_e_cadastrar_paciente(
    cpf: str, 
    dados: schemas.CadastroPacienteApp, 
    db: AsyncSession = Depends(get_db)
):
    # 1. Trava da LGPD
    if not dados.aceitou_lgpd: 
        raise HTTPException(status_code=403, detail="Aceite LGPD obrigatório para o cadastro.")
    
    # 2. Mock do CADSUS
    # Dica Sênior: Se o seu serviço CADSUS fizer chamadas de rede lentas no futuro, 
    # considere transformá-lo em uma função 'async' e usar 'await cadsus.consultar_por_cpf(cpf)'
    dados_gov = cadsus.consultar_por_cpf(cpf)
    if not dados_gov: 
        raise HTTPException(status_code=502, detail="Serviço CADSUS indisponível no momento.")
    
    # 3. Busca assíncrona para evitar travar o Event Loop
    stmt = select(models.Paciente).where(models.Paciente.nr_cpf == cpf)
    result = await db.execute(stmt)
    existente = result.scalar_one_or_none()
    
    if existente: 
        return {"msg": "Paciente já cadastrado em nossa base.", "nome": existente.nm_paciente}

    # 4. Inserção assíncrona
    novo = models.Paciente(
        id_municipio=dados.id_municipio, 
        id_ubs_referencia=dados.id_ubs_referencia,
        nr_cpf=cpf, 
        nr_cns=dados_gov.cns, 
        nm_paciente=dados_gov.nome,
        dt_nascimento=dados_gov.dataNascimento, 
        tp_sexo="I",
        contato={"celular": dados.celular}, 
        is_validado_sus=True,
        dt_aceite_lgpd=datetime.now(timezone.utc) 
    )
    db.add(novo)
    await db.commit()
    await db.refresh(novo)
    
    return {"msg": "Paciente registrado com sucesso!", "id_paciente": novo.id_paciente}


@router.patch("/{id_paciente}/desbloquear", status_code=status.HTTP_200_OK)
async def desbloquear_paciente(
    id_paciente: str, 
    db_tenant: tuple = Depends(get_tenant_db) # <-- Blindagem Sênior: Exige token de funcionário!
):
    """
    Desbloqueia um paciente convertendo suas Faltas ('F') em Faltas Justificadas ('FJ').
    Isso zera a contagem de absenteísmo sem apagar o histórico do banco.
    """
    # Desempacota a tupla do Tenant (Aqui você poderia usar o tenant_id se quisesse fazer um log avançado)
    db, tenant_id = db_tenant

    # Executa um UPDATE em massa alinhado com a modelagem do ItAgendaCentral
    query_desbloqueio = (
        update(models.ItAgendaCentral)
        .where(
            models.ItAgendaCentral.id_paciente == id_paciente,
            models.ItAgendaCentral.tp_situacao == 'F'
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
        "mensagem": f"Paciente desbloqueado com sucesso! {result.rowcount} falta(s) perdoada(s) pela UBS."
    }