# app/routes/feriados.py
from fastapi import APIRouter, Query
from ..services.feriados_service import consultar_feriados_nacionais
from datetime import date

router = APIRouter(prefix="/utilitarios", tags=["Utilitários e Calendário"])

@router.get("/feriados/{ano}")
async def listar_feriados(ano: int):
    """
    Retorna a lista de feriados nacionais para o ano especificado.
    Útil para o Frontend bloquear ou destacar dias no calendário de agendamento.
    """
    return await consultar_feriados_nacionais(ano)

@router.get("/is-feriado")
async def verificar_se_e_feriado(data_consulta: date = Query(...)):
    """
    Verifica se uma data específica é feriado nacional.
    Útil para travas de segurança no Backend.
    """
    feriados = await consultar_feriados_nacionais(data_consulta.year)
    
    # Procura a data na lista de feriados (formato ISO 8601: YYYY-MM-DD)
    data_str = data_consulta.isoformat()
    feriado_encontrado = next((f for f in feriados if f["date"] == data_str), None)
    
    if feriado_encontrado:
        return {"feriado": True, "nome": feriado_encontrado["name"]}
        
    return {"feriado": False}