import pytest
from httpx import Client

@pytest.fixture(scope="session")
def client():
    # Usando testes Black-Box síncronos contra a porta 8000 (Uvicorn vivo)
    # Evita os crashs de event loop do pytest-asyncio!
    with Client(base_url="http://localhost:8000") as c:
        yield c
