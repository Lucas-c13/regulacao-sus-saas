import json
import logging
from datetime import datetime, timedelta
from sqlalchemy.future import select

# Importamos o Redis e a Sessão do Banco de Dados
from app.core.middlewares import redis_client 
from app.database.session import SessionLocal
from app.database import models

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
    """Gera vagas automáticas para escalas ativas."""
    logger.info("Iniciando rotina de geração de agendas...")
    async with SessionLocal() as db:
        stmt = select(models.EscalaCentral).where(models.EscalaCentral.sn_ativo == True)
        result = await db.execute(stmt)
        escalas = result.scalars().all()

        data_atual = datetime.now().date()
        dias_a_gerar = 30
        
        for escala in escalas:
            for i in range(dias_a_gerar):
                dia_alvo = data_atual + timedelta(days=i)
                dia_semana_python = dia_alvo.weekday() + 1 
                
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
            registos = (await db.execute(stmt)).all()
            
            if not registos:
                logger.info(f"Nenhuma consulta agendada para amanhã.")
                return

            sucessos = 0
            for item, paciente, agenda in registos:
                celular = paciente.contato.get("celular") if paciente.contato else None
                hora_formatada = item.hr_agenda.strftime("%H:%M")
                if celular:
                    logger.info(f"📱 SMS Enviado para {celular}: Consulta amanhã às {hora_formatada}")
                    sucessos += 1

            logger.info(f"Rotina concluída! {sucessos} lembretes enviados com sucesso.")
        except Exception as e:
            logger.error(f"Erro fatal no Worker de Lembretes: {str(e)}")