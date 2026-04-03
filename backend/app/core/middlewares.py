# app/core/middlewares.py
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Configuração básica de Logging (Pythônico)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("auditoria")

class AuditoriaMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Passa a requisição para frente e aguarda a resposta do endpoint
        response = await call_next(request)
        
        process_time = time.time() - start_time
        metodos_mutacao = ["POST", "PUT", "PATCH", "DELETE"]

        # Se for uma operação de alteração de dados, registamos a auditoria
        if request.method in metodos_mutacao:
            cliente_ip = request.client.host if request.client else "Desconhecido"
            endpoint = request.url.path
            status = response.status_code
            
            logger.info(
                f"[AUDITORIA] Ação: {request.method} | Rota: {endpoint} | "
                f"Status: {status} | IP: {cliente_ip} | Tempo: {process_time:.4f}s"
            )

        return response