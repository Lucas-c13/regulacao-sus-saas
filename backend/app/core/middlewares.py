from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
import logging
import time

# Configuração básica do logger (em produção, isto iria para o Datadog, AWS CloudWatch, etc.)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("SaaS-Auditoria")

class AuditoriaMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # 1. Passa a requisição para a frente e aguarda a resposta
        response = await call_next(request)
        
        process_time = time.time() - start_time
        
        # 2. Regra do PDF: Gravar log de todos os POST, PUT, PATCH e DELETE
        if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            
            cliente_ip = request.client.host if request.client else "IP Desconhecido"
            endpoint = request.url.path
            status_code = response.status_code
            
            # Aqui poderíamos extrair o ID do utilizador se estiver injetado no request.state
            usuario = getattr(request.state, "user_id", "Desconhecido/Sistema")

            log_message = (
                f"Ação: {request.method} | Rota: {endpoint} | Status: {status_code} | "
                f"IP: {cliente_ip} | Utilizador: {usuario} | Tempo: {process_time:.3f}s"
            )
            
            # Se for um erro (ex: Tentou furar a trava de absenteísmo), logamos como WARNING
            if status_code >= 400:
                logger.warning(f"TENTATIVA BLOQUEADA -> {log_message}")
            else:
                logger.info(f"MUTAÇÃO SUCESSO -> {log_message}")

        return response