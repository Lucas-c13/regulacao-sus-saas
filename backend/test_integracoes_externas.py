import asyncio
import time
import sys
import os
from datetime import datetime

# Garante que o módulo 'app' seja encontrado a partir da raiz do backend
sys.path.insert(0, os.path.dirname(__file__))

from app.services.viacep_service import consultar_cep_async
from app.services.feriados_service import consultar_feriados_nacionais

# O CADSUS é um mock síncrono — importamos a classe diretamente
from app.services.cadsus_service import CADSUSService

# ---------------------------------------------------------------------------
# Constantes de teste
# ---------------------------------------------------------------------------
CEP_TESTE         = "30692520"
CPF_TESTE         = "13249809667"   # CPF informado no brief (sem máscara)
CPF_TESTE_LIMPO   = "".join(filter(str.isdigit, CPF_TESTE))
ANO_ATUAL         = datetime.now().year

SEPARADOR = "─" * 60

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _status_line(ok: bool, servico: str, detalhe: str, elapsed: float) -> str:
    icone = "✅" if ok else "❌"
    return f"  {icone}  {servico:<20} │ {detalhe:<32} │ {elapsed:.3f}s"


def _print_header():
    print()
    print(SEPARADOR)
    print("  🔬  RELATÓRIO DE INTEGRAÇÕES EXTERNAS — QA PRÉ GO-LIVE")
    print(f"  📅  {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}  │  Ambiente: DESENVOLVIMENTO")
    print(SEPARADOR)
    print(f"  {'SERVIÇO':<22} │ {'RESULTADO':<32} │ TEMPO")
    print(SEPARADOR)


def _print_footer(total: int, passou: int):
    reprovados = total - passou
    print(SEPARADOR)
    print(f"  📊  Total: {total}  |  ✅ Passou: {passou}  |  ❌ Falhou: {reprovados}")
    if reprovados == 0:
        print("  🚀  Todas as integrações estão operacionais. LIBERADO PARA GO-LIVE!")
    else:
        print("  🚨  Existem falhas. REVISAR ANTES DO GO-LIVE!")
    print(SEPARADOR)
    print()


# ---------------------------------------------------------------------------
# Testes assíncronos
# ---------------------------------------------------------------------------

async def testar_viacep() -> bool:
    inicio = time.perf_counter()
    try:
        dados = await consultar_cep_async(CEP_TESTE)
        elapsed = time.perf_counter() - inicio
        logradouro = dados.get("logradouro", "—")
        municipio  = dados.get("localidade", "—")
        detalhe    = f"{logradouro[:20]}... | {municipio}"
        print(_status_line(True, "ViaCEP", detalhe[:32], elapsed))
        return True
    except Exception as exc:
        elapsed = time.perf_counter() - inicio
        print(_status_line(False, "ViaCEP", f"ERRO: {str(exc)[:30]}", elapsed))
        return False


async def testar_cadsus() -> bool:
    inicio = time.perf_counter()
    try:
        servico = CADSUSService()
        # A chamada é síncrona com um time.sleep interno — rodamos em executor
        # para não bloquear o event loop durante o teste
        loop = asyncio.get_running_loop()
        resultado = await loop.run_in_executor(None, servico.consultar_por_cpf, CPF_TESTE_LIMPO)
        elapsed = time.perf_counter() - inicio

        if resultado:
            detalhe = f"Paciente: {resultado.nome[:24]}"
            print(_status_line(True, "CADSUS (Mock)", detalhe[:32], elapsed))
            return True
        else:
            print(_status_line(False, "CADSUS (Mock)", "CPF não encontrado no mock", elapsed))
            return False
    except Exception as exc:
        elapsed = time.perf_counter() - inicio
        print(_status_line(False, "CADSUS (Mock)", f"ERRO: {str(exc)[:28]}", elapsed))
        return False


async def testar_feriados() -> bool:
    inicio = time.perf_counter()
    try:
        feriados = await consultar_feriados_nacionais(ANO_ATUAL)
        elapsed  = time.perf_counter() - inicio
        detalhe  = f"{len(feriados)} feriados em {ANO_ATUAL}"
        print(_status_line(True, "BrasilAPI Feriados", detalhe[:32], elapsed))
        return True
    except Exception as exc:
        elapsed = time.perf_counter() - inicio
        print(_status_line(False, "BrasilAPI Feriados", f"ERRO: {str(exc)[:28]}", elapsed))
        return False


# ---------------------------------------------------------------------------
# Orquestrador principal
# ---------------------------------------------------------------------------

async def main():
    _print_header()

    # Suprime o print interno do CADSUSService durante o relatório
    resultados = await asyncio.gather(
        testar_viacep(),
        testar_cadsus(),
        testar_feriados(),
    )

    _print_footer(total=len(resultados), passou=sum(resultados))


if __name__ == "__main__":
    asyncio.run(main())
