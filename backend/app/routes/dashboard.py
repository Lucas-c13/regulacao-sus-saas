from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case, cast, Float, desc, and_
from datetime import date, datetime
from typing import List

from app.database.session import get_db
from app.database import models
from app.core.security import require_gestor_prefeitura, get_tenant_db

router = APIRouter(prefix="/dashboard", tags=["Dashboards e Métricas Gerenciais"])

@router.get("/kpis")
async def obter_kpis_municipio(
    data_inicio: date = Query(..., description="Data inicial do filtro temporal (Obrigatório)"),
    data_fim: date = Query(..., description="Data final do filtro temporal (Obrigatório)"),
    db_tenant: tuple = Depends(get_tenant_db),
    usuario: dict = Depends(require_gestor_prefeitura),
):
    """
    Painel de Visão Global (Nível 2 - Gestor da Prefeitura).
    Requer filtro temporal obrigatório. Demonstra a Taxa de Absenteísmo Global
    da Secretaria de Saúde e o Ranking das 3 UBSs Ofensoras.
    """
    db, tenant_id = db_tenant

    if data_inicio > data_fim:
        raise HTTPException(status_code=400, detail="A data de início não pode ser consecutiva à data de fim.")

    # 1. Agregação Global do Município (Total de Vagas e Faltas)
    stmt_global = (
        select(
            func.count(models.ItAgendaCentral.id_item).label("total_slots"),
            func.sum(case((models.ItAgendaCentral.tp_situacao == 'F', 1), else_=0)).label("total_faltas")
        )
        .join(models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda)
        .where(
            models.AgendaCentral.id_municipio == tenant_id,
            models.AgendaCentral.dt_agenda >= data_inicio,
            models.AgendaCentral.dt_agenda <= data_fim
        )
    )
    result_global = (await db.execute(stmt_global)).first()
    
    total_vagas_periodo = result_global.total_slots or 0
    total_faltas = result_global.total_faltas or 0
    
    taxa_absenteismo_global = round((total_faltas / total_vagas_periodo * 100) if total_vagas_periodo > 0 else 0, 2)

    # 2. Ranking de Ofensores (Top 3 UBSs agrupadas na Engine SQL)
    # Lógica Matemática na Engine de Base de Dados evitando sobrecarga na RAM da API
    taxa_calc = func.coalesce(
        (
            cast(func.sum(case((models.ItAgendaCentral.tp_situacao == 'F', 1), else_=0)), Float) /
            func.nullif(cast(func.count(models.ItAgendaCentral.id_item), Float), 0)
        ) * 100,
        0
    )

    stmt_ranking = (
        select(
            models.UBS.id_ubs,
            models.UBS.nome,
            func.count(models.ItAgendaCentral.id_item).label("total_slots"),
            func.sum(case((models.ItAgendaCentral.tp_situacao == 'F', 1), else_=0)).label("faltas"),
            taxa_calc.label("taxa_absenteismo")
        )
        .select_from(models.ItAgendaCentral)
        .join(models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda)
        .join(models.EscalaCentral, models.AgendaCentral.id_escala == models.EscalaCentral.id_escala)
        .join(models.UBS, models.EscalaCentral.id_ubs == models.UBS.id_ubs)
        .where(
            models.AgendaCentral.id_municipio == tenant_id,
            models.AgendaCentral.dt_agenda >= data_inicio,
            models.AgendaCentral.dt_agenda <= data_fim
        )
        .group_by(models.UBS.id_ubs, models.UBS.nome)
        .order_by(desc("taxa_absenteismo"))
        .limit(3)
    )
    
    resultados_ubs = (await db.execute(stmt_ranking)).all()
    
    top_3_ofensores = [
        {
            "id_ubs": str(r.id_ubs),
            "nome_ubs": r.nome,
            "total_vagas": r.total_slots,
            "total_faltas": r.faltas,
            "taxa_absenteismo_percentual": round(r.taxa_absenteismo, 2)
        }
        for r in resultados_ubs
    ]

    return {
        "filtro_temporal": {
            "inicio": data_inicio.isoformat(),
            "fim": data_fim.isoformat()
        },
        "kpis_globais": {
            "total_vagas_disponiveis": total_vagas_periodo,
            "total_faltas": total_faltas,
            "taxa_absenteismo_global": taxa_absenteismo_global
        },
        "ranking_ofensores_ubs": top_3_ofensores
    }
