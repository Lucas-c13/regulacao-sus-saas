# app/routes/enderecos.py
from fastapi import APIRouter
from ..services.viacep_service import consultar_cep_async

router = APIRouter(prefix="/enderecos", tags=["Endereços e CEP"])

@router.get("/cep/{cep}")
async def buscar_endereco_por_cep(cep: str):
    """
    Rota utilizada pelo Frontend para auto-completar formulários de endereço.
    Retorna os dados limpos e prontos para o React.
    """
    dados_viacep = await consultar_cep_async(cep)
    
    # Retornamos apenas o que importa para o seu front-end
    return {
        "cep": dados_viacep.get("cep"),
        "logradouro": dados_viacep.get("logradouro"),
        "bairro": dados_viacep.get("bairro"),
        "cidade": dados_viacep.get("localidade"),
        "uf": dados_viacep.get("uf"),
        "ibge": dados_viacep.get("ibge") # Útil se for vincular a tabela Municipio do banco!
    }