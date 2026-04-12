import logging
import time
import json
import redis.asyncio as redis
from jose import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Já não precisamos de importar a BD aqui (models e Session), 
# pois a gravação no Postgres foi transferida para as tasks (APScheduler)
from ..core.security import SECRET_KEY, ALGORITHM 

# =========================================================
# CONFIGURAÇÃO DO REDIS (Buffer de Alta Performance)
# =========================================================
redis_client = redis.Redis(host='agendamento_redis', port=6379, db=0, decode_responses=True)

# Configuração básica do logger
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
            endpoint = str(request.url.path)
            status_code = response.status_code
            
            # 3. Extrair o Usuário do JWT
            usuario_id = None
            tenant_id = None
            nome_usuario = "Sistema/Desconhecido"
            
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                try:
                    token = auth_header.split(" ")[1]
                    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                    usuario_id = payload.get("id_profissional")
                    tenant_id = payload.get("tenant_id")
                    nome_usuario = payload.get("sub", "Profissional")
                except Exception:
                    pass # Token inválido ou rota pública

            # --- PARTE 1: LOG NO TERMINAL ---
            log_message = (
                f"Ação: {request.method} | Rota: {endpoint} | Status: {status_code} | "
                f"IP: {cliente_ip} | Usuário: {nome_usuario} | Tempo: {process_time:.3f}s"
            )
            
            if status_code >= 400:
                logger.warning(f"TENTATIVA BLOQUEADA -> {log_message}")
            else:
                logger.info(f"MUTAÇÃO SUCESSO -> {log_message}")

            # --- PARTE 2: BUFFER NO REDIS (Substitui o insert direto na BD) ---
            # Montamos o objeto JSON para a fila
            log_data = {
                "id_usuario": usuario_id,
                "id_municipio": tenant_id,
                "metodo": request.method,
                "endpoint": endpoint,
                "ip_origem": cliente_ip,
                "status_code": status_code,
                "payload": {"nota": "Gravado via Bulk Insert do Redis"}
            }
            
            # Envia para a fila 'audit_logs' em menos de 1ms
            try:
                await redis_client.rpush("audit_logs", json.dumps(log_data))
            except Exception as e:
                logger.error(f"Erro ao escrever log no Redis: {e}")

        return response