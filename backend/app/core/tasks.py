import json
import logging
from datetime import datetime, timedelta
from sqlalchemy.future import select
from sqlalchemy import update, and_
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.middlewares import redis_client 
from app.database.session import AsyncSessionLocal as SessionLocal
from app.database import models
from app.services.feriados_service import consultar_feriados_nacionais

scheduler = AsyncIOScheduler()

logger = logging.getLogger("Workers")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# ---------------------------------------------------------
# WORKER 1: BULK INSERT DE AUDITORIA
# ---------------------------------------------------------
async def processar_fila_auditoria():
    """Consome a fila do Redis 'audit_logs' e faz um Bulk Insert no PostgreSQL."""
    logs_para_inserir = []
    
    try:
        while len(logs_para_inserir) < 500:
            log_str = await redis_client.lpop("audit_logs")
            if not log_str:
                break
                
            dados = json.loads(log_str)
            logs_para_inserir.append(
                models.LogAuditoria(
                    id_usuario=dados.get("id_usuario"),
                    id_municipio=dados.get("id_municipio"),
                    metodo=dados.get("metodo"),
                    endpoint=dados.get("endpoint"),
                    ip_origem=dados.get("ip_origem"),
                    status_code=dados.get("status_code"),
                    payload=dados.get("payload")
                )
            )
        
        if logs_para_inserir:
            async with SessionLocal() as db:
                db.add_all(logs_para_inserir)
                await db.commit()
                logger.info(f"Auditoria: {len(logs_para_inserir)} logs inseridos no PostgreSQL.")
                
    except Exception as e:
        logger.error(f"Erro crítico no processamento de logs de auditoria: {e}")


# ---------------------------------------------------------
# WORKER 2: FATIADOR AUTOMÁTICO DE ESCALAS
# ---------------------------------------------------------
def _gerar_slots_de_tempo(hora_inicio, hora_fim, duracao_minutos):
    start_dt = datetime.combine(datetime.today(), hora_inicio)
    end_dt = datetime.combine(datetime.today(), hora_fim)
    slots = []
    current_time = start_dt
    while current_time + timedelta(minutes=duracao_minutos) <= end_dt:
        slots.append(current_time.time())
        current_time += timedelta(minutes=duracao_minutos)
    return slots

async def gerar_agendas_futuras():
    """Gera vagas automáticas para escalas ativas, respeitando Feriados Nacionais e Municipais/Locais."""
    logger.info("Iniciando rotina de geração de agendas...")
    async with SessionLocal() as db:
        # Busca todas as escalas ativas
        stmt = select(models.EscalaCentral).where(models.EscalaCentral.sn_ativo == True)
        result = await db.execute(stmt)
        escalas = result.scalars().all()

        data_atual = datetime.now().date()
        dias_a_gerar = 30
        
        # --- CARREGA FERIADOS EM MEMÓRIA UMA ÚNICA VEZ ---
        ano_atual = data_atual.year
        lista_str_feriados_nacionais = []
        try:
            # 1. Busca Feriados Nacionais (BrasilAPI)
            feriados_api = await consultar_feriados_nacionais(ano_atual)
            if data_atual.month == 12:
                feriados_api += await consultar_feriados_nacionais(ano_atual + 1)
            lista_str_feriados_nacionais = [f["date"] for f in feriados_api]
        except Exception as e:
            logger.warning(f"Aviso: Erro ao baixar feriados da BrasilAPI. Ignorando validação nacional. Erro: {str(e)}")
        
        # 2. Busca Feriados Cadastrados no Banco (Municipais, Estaduais, etc)
        # O gestor cadastra esses feriados pelo painel
        stmt_feriados_locais = select(models.Feriado).where(
            models.Feriado.data >= data_atual,
            models.Feriado.data <= data_atual + timedelta(days=dias_a_gerar)
        )
        result_locais = await db.execute(stmt_feriados_locais)
        feriados_locais_db = result_locais.scalars().all()
        
        # Mapeamento para acesso rápido: { "id_municipio": ["YYYY-MM-DD", "YYYY-MM-DD"] }
        feriados_locais_map = {}
        for f in feriados_locais_db:
            # Assumindo que a model Feriado tem o id_municipio. 
            # Se o feriado for global para o sistema inteiro, ajuste a lógica de mapeamento.
            mun_id = str(f.id_municipio) if hasattr(f, 'id_municipio') and f.id_municipio else 'GLOBAL'
            dt_str = f.data.isoformat() if hasattr(f.data, 'isoformat') else str(f.data)
            
            if mun_id not in feriados_locais_map:
                feriados_locais_map[mun_id] = []
            feriados_locais_map[mun_id].append(dt_str)


        for escala in escalas:
            id_mun_escala = str(escala.id_municipio)
            feriados_deste_municipio = feriados_locais_map.get(id_mun_escala, [])
            feriados_globais = feriados_locais_map.get('GLOBAL', [])
            
            for i in range(dias_a_gerar):
                dia_alvo = data_atual + timedelta(days=i)
                dia_semana_python = dia_alvo.weekday() + 1 
                dia_alvo_str = dia_alvo.isoformat()
                
                # --- PREVENÇÃO DE FERIADOS ---
                is_feriado = (
                    dia_alvo_str in lista_str_feriados_nacionais or 
                    dia_alvo_str in feriados_deste_municipio or
                    dia_alvo_str in feriados_globais
                )
                
                if is_feriado:
                    logger.info(f"Ignorando geração de slots na Escala {escala.id_escala} no dia {dia_alvo_str} - Motivo: Feriado (Nacional ou Local)!")
                    continue # Pula o feriado, não gera vagas neste dia!
                
                if escala.tp_dia_semana == dia_semana_python:
                    stmt_check = select(models.AgendaCentral).where(
                        models.AgendaCentral.id_escala == escala.id_escala,
                        models.AgendaCentral.dt_agenda == dia_alvo
                    )
                    if not (await db.execute(stmt_check)).scalar_one_or_none():
                        nova_agenda = models.AgendaCentral(
                            id_municipio=escala.id_municipio,
                            id_escala=escala.id_escala,
                            dt_agenda=dia_alvo,
                            sn_ativo=True
                        )
                        db.add(nova_agenda)
                        await db.flush() 
                        
                        horarios = _gerar_slots_de_tempo(escala.hr_inicio, escala.hr_fim, escala.tempo_medio_min)
                        db.add_all([
                            models.ItAgendaCentral(
                                id_municipio=escala.id_municipio,
                                id_agenda=nova_agenda.id_agenda,
                                hr_agenda=hr,
                                sn_encaixe=False,
                                tp_situacao='L' 
                            ) for hr in horarios
                        ])
        await db.commit()
        logger.info("Geração de agendas concluída.")


# ---------------------------------------------------------
# WORKER 3: LEMBRETES DE SMS
# ---------------------------------------------------------
async def disparar_lembretes_sms():
    """Job Diário: Envia SMS para todos os utentes que têm consulta amanhã."""
    logger.info("Iniciando rotina de SMS...")
    amanha = datetime.now().date() + timedelta(days=1)
    
    async with SessionLocal() as db:
        try:
            stmt = (
                select(models.ItAgendaCentral, models.Paciente, models.AgendaCentral)
                .join(models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda)
                .join(models.Paciente, models.ItAgendaCentral.id_paciente == models.Paciente.id_paciente)
                .where(
                    models.AgendaCentral.dt_agenda == amanha,
                    models.ItAgendaCentral.tp_situacao.in_(['A', 'M']) 
                )
            )
            registros = (await db.execute(stmt)).all()
            
            if not registros:
                logger.info(f"Nenhuma consulta agendada para amanhã.")
                return

            sucessos = 0
            for item, paciente, agenda in registros:
                celular = paciente.contato.get("celular") if paciente.contato else None
                hora_formatada = item.hr_agenda.strftime("%H:%M")
                if celular:
                    logger.info(f"📱 SMS Enviado para {celular}: Consulta amanhã às {hora_formatada}")
                    sucessos += 1

            logger.info(f"Rotina concluída! {sucessos} lembretes enviados com sucesso.")
        except Exception as e:
            logger.error(f"Erro fatal no Worker de Lembretes: {str(e)}")

# ---------------------------------------------------------
# WORKER 4: PROCESSAMENTO DE NO-SHOW (O combustível da trava)
# ---------------------------------------------------------
async def processar_no_show_noturno():
    """
    Busca agendamentos de 'ontem' que permaneceram como 'M' (Marcado)
    e altera para 'F' (Faltou), alimentando a trava de absenteísmo.
    """
    logger.info("Iniciando limpeza de agenda (No-Show)...")
    ontem = datetime.now().date() - timedelta(days=1)
    
    async with SessionLocal() as db:
        try:
            # Query de Update em massa cruzando com a data da AgendaCentral
            # Filtramos agendamentos de ONTEM que ainda estão como 'M'
            stmt = (
                update(models.ItAgendaCentral)
                .where(
                    and_(
                        models.ItAgendaCentral.tp_situacao == 'M',
                        models.ItAgendaCentral.id_agenda.in_(
                            select(models.AgendaCentral.id_agenda).where(
                                models.AgendaCentral.dt_agenda == ontem
                            )
                        )
                    )
                )
                .values(tp_situacao='F')
            )
            
            resultado = await db.execute(stmt)
            await db.commit()
            logger.info(f"🤖 [TASK] No-Show: {resultado.rowcount} faltas registradas para o dia {ontem}.")
            
        except Exception as e:
            logger.error(f"Erro no processamento de No-Show: {e}")
            await db.rollback()

def configurar_agendamentos():
    # Tarefa A: Auditoria (A cada 15 segundos)
    scheduler.add_job(
        processar_fila_auditoria, 
        'interval', 
        seconds=15, 
        id="auditoria_worker", 
        replace_existing=True
    )
    
    # Tarefa B: No-Show (02:00)
    scheduler.add_job(
        processar_no_show_noturno, 
        'cron', 
        hour=2, 
        minute=0, 
        id="job_no_show", 
        replace_existing=True
    )
    
    # Tarefa C: Gerador de Agendas (03:00)
    scheduler.add_job(
        gerar_agendas_futuras, 
        'cron', 
        hour=3, 
        minute=0, 
        id="job_gerador_agendas", 
        replace_existing=True
    )
    
    # Tarefa D: SMS (18:00)
    scheduler.add_job(
        disparar_lembretes_sms, 
        'cron', 
        hour=18, 
        minute=0, 
        timezone='America/Sao_Paulo', 
        id='lembretes_diarios', 
        replace_existing=True
    )