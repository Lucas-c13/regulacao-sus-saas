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

# O worker de geração automática foi desativado pois agora as escalas têm período
# definido e são geradas integralmente no momento da criação para garantir precisão.


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
    
    # O Worker de geração de agendas foi removido e integrado na criação da escala.
    
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