# app/core/tasks.py
import logging
from datetime import date
from ..database.session import SessionLocal
from ..database import models

# Configuração de log para vermos a tarefa a correr no terminal
logger = logging.getLogger("apscheduler")
logging.basicConfig(level=logging.INFO)

def processar_no_shows():
    """
    Job Noturno: Varre a base de dados em busca de pacientes que não
    compareceram (Status 'M') no dia atual (ou anteriores) e altera para 'F' (Faltou).
    """
    db = SessionLocal() # Abre uma sessão independente
    try:
        hoje = date.today()
        logger.info(f"🌙 A iniciar o processamento de No-Shows (Faltas) para: {hoje}")

        # 1. Encontrar todas as agendas de hoje (ou passadas que ficaram pendentes)
        agendas = db.query(models.AgendaCentral).filter(
            models.AgendaCentral.dt_agenda <= hoje
        ).all()

        ids_agendas = [agenda.id_agenda for agenda in agendas]

        if not ids_agendas:
            logger.info("Nenhuma agenda encontrada para processar.")
            return

        # 2. Buscar todos os slots com status 'M' (Marcado) nessas agendas
        marcados = db.query(models.ItAgendaCentral).filter(
            models.ItAgendaCentral.id_agenda.in_(ids_agendas),
            models.ItAgendaCentral.tp_situacao == 'M'
        ).all()

        # 3. Alterar para 'F' (Faltou)
        total_atualizados = 0
        for item in marcados:
            item.tp_situacao = 'F'
            total_atualizados += 1

        db.commit() # Salva todas as faltas de uma só vez
        logger.info(f"✅ Processamento concluído: {total_atualizados} pacientes marcados como 'Faltou'.")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro na tarefa de No-Show: {e}")
    finally:
        db.close() # Garante que não deixamos ligações abertas na base de dados