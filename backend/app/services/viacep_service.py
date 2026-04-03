# app/services/viacep_service.py
import httpx
from fastapi import HTTPException

async def consultar_cep_async(cep: str) -> dict:
    """
    Consulta o webservice do ViaCEP de forma assíncrona.
    Não bloqueia o Event Loop do FastAPI.
    """
    # Limpa a string deixando apenas números
    cep_limpo = ''.join(filter(str.isdigit, cep))
    
    if len(cep_limpo) != 8:
        raise HTTPException(status_code=400, detail="CEP deve conter exatamente 8 dígitos.")
    
    url = f"https://viacep.com.br/ws/{cep_limpo}/json/"
    
    # Fazemos a chamada de forma assíncrona
    async with httpx.AsyncClient() as client:
        try:
            resposta = await client.get(url, timeout=5.0)
            resposta.raise_for_status()
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Serviço ViaCEP temporariamente indisponível.")
            
    dados = resposta.json()
    
    # O ViaCEP retorna status 200 mesmo se o CEP não existir, mas manda um {"erro": true}
    if dados.get("erro"):
        raise HTTPException(status_code=404, detail="CEP não encontrado na base dos Correios.")
        
    return dados