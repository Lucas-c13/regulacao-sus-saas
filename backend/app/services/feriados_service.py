# app/services/feriados_service.py
import httpx
from fastapi import HTTPException
from typing import List, Dict

async def consultar_feriados_nacionais(ano: int) -> List[Dict]:
    """
    Consome a BrasilAPI para buscar feriados de um ano específico.
    Calcula automaticamente feriados móveis (Páscoa, etc).
    """
    if not (1900 <= ano <= 2199):
        raise HTTPException(status_code=400, detail="Ano fora do intervalo suportado (1900-2199).")

    url = f"https://brasilapi.com.br/api/feriados/v1/{ano}"
    
    async with httpx.AsyncClient() as client:
        try:
            # Timeout de 5s para não travar o sistema se a API externa demorar
            resposta = await client.get(url, timeout=5.0)
            
            if resposta.status_code == 404:
                raise HTTPException(status_code=404, detail="Ano não encontrado no serviço de feriados.")
                
            resposta.raise_for_status()
            return resposta.json()
            
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Erro ao conectar ao serviço BrasilAPI.")