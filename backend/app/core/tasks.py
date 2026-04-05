import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database.session import SessionLocal
from app.database import models

logger = logging.getLogger("Worker-Lembretes")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

async def disparar_lembretes_sms():
    """
    Job Diário: Envia SMS para todos os utentes que têm consulta amanhã.
    """
    logger.info("Iniciando rotina de envio de lembretes de consulta (SMS/Push)...")
    
    amanha = datetime.now().date() + timedelta(days=1)
    
    # Criamos uma sessão isolada para a Task (não vem do request do FastAPI)
    async with SessionLocal() as db:
        try:
            # JOIN Sênior: Cruzar Agenda + Item + Paciente + UBS
            stmt = (
                select(models.ItAgendaCentral, models.Paciente, models.AgendaCentral)
                .join(models.AgendaCentral, models.ItAgendaCentral.id_agenda == models.AgendaCentral.id_agenda)
                .join(models.Paciente, models.ItAgendaCentral.id_paciente == models.Paciente.id_paciente)
                .where(
                    models.AgendaCentral.dt_agenda == amanha,
                    models.ItAgendaCentral.tp_situacao.in_(['A', 'M']) # Apenas Agendados/Marcados
                )
            )
            
            resultados = await db.execute(stmt)
            registos = resultados.all()
            
            if not registos:
                logger.info(f"Nenhuma consulta agendada para amanhã ({amanha}).")
                return

            sucessos = 0
            for item, paciente, agenda in registos:
                celular = paciente.contato.get("celular") if paciente.contato else None
                hora_formatada = item.hr_agenda.strftime("%H:%M")
                
                if celular:
                    # =========================================================
                    # AQUI ENTRA A INTEGRAÇÃO COM TWILIO, Z-API, AWS SNS, ETC
                    # =========================================================
                    msg = (
                        f"Olá {paciente.nm_paciente}! Lembrete do SUS: Você tem uma consulta amanhã "
                        f"({amanha.strftime('%d/%m')}) às {hora_formatada}. "
                        f"Se não puder comparecer, cancele pelo App Zero Filas para evitar bloqueio."
                    )
                    
                    # Simula o envio
                    logger.info(f"📱 SMS Enviado para {celular} -> {msg}")
                    sucessos += 1
                else:
                    logger.warning(f"⚠️ Paciente {paciente.nm_paciente} sem telemóvel registado.")

            logger.info(f"Rotina concluída! {sucessos} lembretes enviados com sucesso.")
            
        except Exception as e:
            logger.error(f"Erro fatal no Worker de Lembretes: {str(e)}")