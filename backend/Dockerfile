# 1. Imagem Base Oficial (Slim para ser leve e segura)
FROM python:3.11-slim

# 2. Impedir que o Python crie ficheiros .pyc e forçar o log direto no terminal
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Diretório de trabalho dentro do contentor
WORKDIR /app

# 4. Instalar dependências do sistema operacional necessárias para compilar algumas libs (ex: psycopg2)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 5. Copiar apenas o ficheiro de dependências primeiro (aproveita o cache do Docker)
COPY requirements.txt .

# 6. Instalar as bibliotecas Python
RUN pip install --no-cache-dir -r requirements.txt

# 7. Copiar o resto do código da aplicação
COPY . .

# 8. Expor a porta que o FastAPI vai usar
EXPOSE 8000

# 9. Comando de arranque para Produção
# O uvicorn vai rodar escutando em todos os IPs (0.0.0.0)
CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "120"]