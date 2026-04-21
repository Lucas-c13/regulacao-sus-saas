from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from typing import List
from datetime import date
import uuid

from ..database.session import get_db
from ..database import models
from ..schemas import schemas
from ..core.security import get_usuario_logado

router = APIRouter(prefix="/escalas", tags=["Escalas"])

@router.post("/", response_model=schemas.EscalaCentralResponse, status_code=status.HTTP_201_CREATED)
async def criar_escala(
    dados: schemas.EscalaCentralCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    tenant_id = usuario.get("tenant_id")

    import logging
    logger = logging.getLogger(__name__)

    # 1. Validar se a UBS pertence ao Município
    try:
        stmt_ubs = select(models.UBS).filter_by(id_ubs=dados.id_ubs, id_municipio=tenant_id)
        ubs = (await db.execute(stmt_ubs)).scalar_one_or_none()
        if not ubs:
            raise HTTPException(status_code=403, detail="Acesso negado: UBS não encontrada no seu município.")

        # 2. Validar se o profissional pertence ao Município
        stmt_prof = select(models.Profissional).filter_by(id_profissional=dados.id_profissional, id_municipio=tenant_id)
        profissional = (await db.execute(stmt_prof)).scalar_one_or_none()
        if not profissional:
            raise HTTPException(status_code=404, detail="Profissional não encontrado no seu município.")

        # 3. Lógica de Negócio: Prevenir sobreposição
        stmt_sobreposicao = select(models.EscalaCentral).filter(
            and_(
                models.EscalaCentral.id_profissional == dados.id_profissional,
                models.EscalaCentral.id_ubs == dados.id_ubs,
                models.EscalaCentral.sn_ativo == True,
                models.EscalaCentral.id_municipio == tenant_id,
                models.EscalaCentral.tp_dia_semana == dados.tp_dia_semana,
                # Verifica intersecção de horários
                models.EscalaCentral.hr_inicio < dados.hr_fim,
                models.EscalaCentral.hr_fim > dados.hr_inicio
            )
        )
        sobreposicao = (await db.execute(stmt_sobreposicao)).first()
        
        if sobreposicao:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail="O profissional já possui uma escala ativa que se sobrepõe a este horário nesta UBS."
            )

        # 4. Calcular Quantidade de Atendimentos Sugerida
        from datetime import datetime
        dummy_date = date.today()
        dt_inicio = datetime.combine(dummy_date, dados.hr_inicio)
        dt_fim = datetime.combine(dummy_date, dados.hr_fim)
        if dt_fim < dt_inicio:
             minutos_totais = 0
        else:
             minutos_totais = (dt_fim - dt_inicio).seconds // 60
        
        qt_sugerida = minutos_totais // dados.tempo_medio_min if dados.tempo_medio_min > 0 else 0

        # 5. Criar a Escala (Molde)
        nova_escala = models.EscalaCentral(
            id_ubs=dados.id_ubs,
            id_profissional=dados.id_profissional,
            id_especialidade=dados.id_especialidade,
            tp_dia_semana=dados.tp_dia_semana,
            dt_inicio=dados.dt_inicio,
            dt_fim=dados.dt_fim,
            dt_disponibilidade=dados.dt_disponibilidade,
            hr_inicio=dados.hr_inicio,
            hr_fim=dados.hr_fim,
            qt_atendimento=qt_sugerida,
            tempo_medio_min=dados.tempo_medio_min,
            is_disponivel_app=dados.is_disponivel_app,
            sn_bloqueia_feriados=dados.sn_bloqueia_feriados,
            id_municipio=tenant_id,
            sn_ativo=True
        )

        db.add(nova_escala)
        await db.flush() # Para gerar o id_escala antes de criar as agendas

        # 6. GERAÇÃO IMEDIATA DE VAGAS (Fábrica de Agenda)
        from datetime import timedelta
        from ..services.feriados_service import consultar_feriados_nacionais
        
        # Carregar feriados uma vez
        feriados_nacionais = []
        try:
            feriados_nacionais = [f["date"] for f in await consultar_feriados_nacionais(dados.dt_inicio.year)]
            if dados.dt_fim.year > dados.dt_inicio.year:
                feriados_nacionais += [f["date"] for f in await consultar_feriados_nacionais(dados.dt_fim.year)]
        except: pass

        stmt_feriados_locais = select(models.Feriado.data).where(
            and_(
                models.Feriado.id_municipio == tenant_id,
                models.Feriado.data >= dados.dt_inicio,
                models.Feriado.data <= dados.dt_fim
            )
        )
        feriados_locais = (await db.execute(stmt_feriados_locais)).scalars().all()
        feriados_locais_str = [d.isoformat() for d in feriados_locais]

        current_date = dados.dt_inicio
        while current_date <= dados.dt_fim:
            # weekday() 0=Segunda, 6=Domingo. Nosso tp_dia_semana 1=Segunda, 7=Domingo
            if (current_date.weekday() + 1) == dados.tp_dia_semana:
                # Verificar feriado
                if dados.sn_bloqueia_feriados:
                    if current_date.isoformat() in feriados_nacionais or current_date.isoformat() in feriados_locais_str:
                        current_date += timedelta(days=1)
                        continue

                # Cria o dia da agenda
                agenda_dia = models.AgendaCentral(
                    id_municipio=tenant_id,
                    id_escala=nova_escala.id_escala,
                    dt_agenda=current_date,
                    sn_ativo=True
                )
                db.add(agenda_dia)
                await db.flush()

                # Gera os slots (Itens)
                from .agendamentos import gerar_slots_tempo
                for hr in gerar_slots_tempo(dados.hr_inicio, dados.hr_fim, dados.tempo_medio_min):
                    item = models.ItAgendaCentral(
                        id_municipio=tenant_id,
                        id_agenda=agenda_dia.id_agenda,
                        hr_agenda=hr,
                        sn_encaixe=False,
                        tp_situacao='L'
                    )
                    db.add(item)

            current_date += timedelta(days=1)

        await db.commit()
        await db.refresh(nova_escala)
        return nova_escala
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("ERRO CRITICAL NA CRIACAO DE ESCALA")
        raise HTTPException(status_code=500, detail=f"Erro interno de gravação: {str(e)}")


@router.get("/", response_model=List[schemas.EscalaCentralResponse])
async def listar_escalas(
    id_ubs: str = None,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Lista as escalas do município. Se id_ubs for fornecido, filtra por UBS.
    """
    tenant_id = usuario.get("tenant_id")
    
    query = select(models.EscalaCentral).filter(
        models.EscalaCentral.id_municipio == tenant_id,
        models.EscalaCentral.sn_ativo == True
    )

    if id_ubs:
        query = query.filter(models.EscalaCentral.id_ubs == id_ubs)

    resultados = (await db.execute(query)).scalars().all()
    return resultados


@router.patch("/{id_escala}/desativar")
async def desativar_escala(
    id_escala: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(get_usuario_logado)
):
    """
    Desativa (Soft Delete) uma escala para que não gere mais agendas futuras.
    """
    stmt = select(models.EscalaCentral).filter_by(
        id_escala=id_escala, 
        id_municipio=usuario.get("tenant_id")
    )
    escala = (await db.execute(stmt)).scalar_one_or_none()

    if not escala:
        raise HTTPException(status_code=404, detail="Escala não encontrada ou sem permissão de acesso.")

    escala.sn_ativo = False
    await db.commit()

    return {"msg": "Escala desativada com sucesso. Não irá gerar vagas para datas futuras."}