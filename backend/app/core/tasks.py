# app/core/tasks.py
import logging
from datetime import date
from ..database.session import SessionLocal
from ..database import models
from datetime import timedelta

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

def gerar_agendas_automaticamente():
    """
    Job Noturno: Lê os moldes (EscalaCentral) e gera as agendas (AgendaCentral)
    para os próximos 30 dias de forma massiva e agnóstica de base de dados (ANSI).
    """
    db = SessionLocal()
    try:
        hoje = date.today()
        limite = hoje + timedelta(days=30) # Previsibilidade de 1 mês para a UBS
        logger.info(f"⚙️ A iniciar a Geração de Agendas de {hoje} até {limite}...")

        # 1. Buscar todas as escalas ativas (Os "Moldes")
        escalas = db.query(models.EscalaCentral).all()
        if not escalas:
            logger.info("Nenhuma Escala Central configurada. A abortar.")
            return

        # 2. Buscar as agendas que já foram geradas para este período (Evitar duplicação)
        # Trazemos apenas as colunas estritamente necessárias para não sobrecarregar a memória RAM
        agendas_existentes = db.query(
            models.AgendaCentral.id_escala, 
            models.AgendaCentral.dt_agenda
        ).filter(
            models.AgendaCentral.dt_agenda >= hoje,
            models.AgendaCentral.dt_agenda <= limite
        ).all()

        # Usamos um SET (Hash Map) em memória para pesquisas ultrarrápidas com performance O(1)
        set_existentes = {(str(a.id_escala), a.dt_agenda) for a in agendas_existentes}

        novas_agendas = []

        # 3. Fatiar os próximos 30 dias
        for i in range(31):
            data_alvo = hoje + timedelta(days=i)
            
            # isoweekday() retorna de 1 (Segunda) a 7 (Domingo), o que bate perfeitamente com a nossa modelagem
            dia_semana_iso = data_alvo.isoweekday() 

            # Filtrar em memória as escalas que devem rodar neste dia da semana
            escalas_do_dia = [e for e in escalas if e.tp_dia_semana == dia_semana_iso]

            for escala in escalas_do_dia:
                chave = (str(escala.id_escala), data_alvo)
                
                # Se a agenda para esta escala e data ainda não existe na base de dados, preparamos a inserção
                if chave not in set_existentes:
                    nova = models.AgendaCentral(
                        id_escala=escala.id_escala,
                        dt_agenda=data_alvo,
                        sn_ativo=True
                    )
                    novas_agendas.append(nova)

        # 4. Inserção Massiva (O Segredo do Padrão ANSI para Alta Performance)
        if novas_agendas:
            # bulk_save_objects é muito mais rápido que um loop infinito de db.add()
            db.bulk_save_objects(novas_agendas)
            db.commit()
            logger.info(f"✅ Sucesso! {len(novas_agendas)} novas agendas criadas via Bulk Insert.")
        else:
            logger.info("⚡ As agendas dos próximos 30 dias já estão atualizadas. Nenhuma ação necessária.")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao gerar agendas: {e}")
    finally:
        db.close()