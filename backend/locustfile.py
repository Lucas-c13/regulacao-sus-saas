"""
locustfile.py — Load Test do SaaS de Agendamento APS
=====================================================
Simula os 5 cenários de carga mais críticos do sistema.

USO:
  # Instalar (uma vez):
  pip install locust

  # Modo interativo (abre UI em http://localhost:8089):
  locust -f locustfile.py --host http://localhost:8000

  # Modo headless (CI/CD ou linha de comando):
  locust -f locustfile.py --host http://localhost:8000 \
         --headless -u 200 -r 20 --run-time 60s \
         --html relatorio_load.html

PARÂMETROS RECOMENDADOS PARA TESTE:
  -u  (users)     : número total de usuários simultâneos
  -r  (spawn-rate): usuários novos por segundo
  --run-time      : duração do teste

NÍVEIS DE CARGA SUGERIDOS:
  Smoke Test   → -u 10  -r 2  --run-time 30s
  Load Test    → -u 200 -r 20 --run-time 60s
  Stress Test  → -u 500 -r 50 --run-time 120s
"""

import json
import random
from locust import HttpUser, task, between, events

# ─────────────────────────────────────────────
# CONFIGURAÇÃO — ajuste conforme o seu seed_db.py
# ─────────────────────────────────────────────
ADMIN_CPF         = "11122233344"
ADMIN_SENHA       = "admin123"

# Preenchido automaticamente no on_start — não edite
_id_municipio: str = ""
_id_ubs:       str = ""
_id_paciente:  str = ""
_id_escala:    str = ""


# ─────────────────────────────────────────────
# USUÁRIO SIMULADO — Recepcionista / Gestor
# ─────────────────────────────────────────────
class UsuarioSistema(HttpUser):
    """
    Simula um operador autenticado fazendo operações reais no sistema.
    wait_time: pausa entre tarefas (simula tempo de digitação/leitura do operador).
    """
    wait_time = between(0.5, 2.0)

    token: str = ""
    id_municipio: str = ""
    id_ubs: str = ""
    id_paciente: str = ""
    id_escala: str = ""
    id_item_agenda: str = ""

    # ─── INICIALIZAÇÃO: Login e coleta de IDs ─────────────────────────────────
    def on_start(self):
        """Executado uma vez por usuário simulado antes dos testes começarem."""
        self._fazer_login()
        if self.token:
            self._coletar_ids()

    def _fazer_login(self):
        """Autentica com o usuário seed e captura o JWT."""
        with self.client.post(
            "/auth/verificar-acessos",
            json={"cpf": ADMIN_CPF},
            name="/auth/verificar-acessos",
            catch_response=True
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Verificar acessos falhou: {resp.status_code}")
                return
            vinculos = resp.json().get("vinculos", [])
            if not vinculos:
                resp.failure("Nenhum vínculo encontrado para o CPF de teste.")
                return
            self.id_municipio = vinculos[0]["id_municipio"]

        with self.client.post(
            "/auth/login",
            data={
                "username": ADMIN_CPF,
                "password": ADMIN_SENHA,
                "client_id": self.id_municipio
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            name="/auth/login",
            catch_response=True
        ) as resp:
            if resp.status_code == 200:
                body = resp.json()
                self.token = body.get("access_token", "")
                id_ubs_raw = body.get("usuario", {}).get("id_ubs")
                self.id_ubs = str(id_ubs_raw) if id_ubs_raw else ""
            elif resp.status_code == 428:
                resp.failure("Login bloqueado: is_senha_provisoria=True. Rode seed_db novamente.")
            else:
                resp.failure(f"Login falhou: {resp.status_code} — {resp.text}")

    def _coletar_ids(self):
        """Coleta IDs reais do banco para usar nas tasks."""
        headers = self._headers()

        # Pacientes
        r = self.client.get("/pacientes/", headers=headers, name="/pacientes/ [setup]")
        if r.status_code == 200 and r.json():
            self.id_paciente = r.json()[0].get("id_paciente", "")

        # Escalas
        r = self.client.get("/escalas/", headers=headers, name="/escalas/ [setup]")
        if r.status_code == 200 and r.json():
            self.id_escala = r.json()[0].get("id_escala", "")

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    # ─── TASK 1: Login (peso 1) ────────────────────────────────────────────────
    @task(1)
    def cenario_login(self):
        """
        Simula pico de autenticação.
        Peso 1 — menos frequente que consultas de agenda.
        """
        # Primeiro passo: verificar CPF
        with self.client.post(
            "/auth/verificar-acessos",
            json={"cpf": ADMIN_CPF},
            name="[C1] POST /auth/verificar-acessos",
            catch_response=True
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Status inesperado: {resp.status_code}")

        # Segundo passo: login completo
        with self.client.post(
            "/auth/login",
            data={
                "username": ADMIN_CPF,
                "password": ADMIN_SENHA,
                "client_id": self.id_municipio
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            name="[C1] POST /auth/login",
            catch_response=True
        ) as resp:
            if resp.status_code not in (200, 428):
                resp.failure(f"Login falhou com status {resp.status_code}")

    # ─── TASK 2: Consulta de slots disponíveis (peso 5) ───────────────────────
    @task(5)
    def cenario_slots_disponiveis(self):
        """
        Rota mais acessada do sistema — cidadãos consultando vagas disponíveis.
        Peso 5 — maior frequência, pois é leitura pura (GET).
        """
        if not self.id_escala:
            return

        with self.client.get(
            f"/agendamentos/disponiveis?id_escala={self.id_escala}",
            headers=self._headers(),
            name="[C2] GET /agendamentos/disponiveis",
            catch_response=True
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f"Status inesperado: {resp.status_code} — {resp.text[:100]}")

    # ─── TASK 3: Reserva de agendamento (peso 2) ──────────────────────────────
    @task(2)
    def cenario_reservar_agendamento(self):
        """
        Operação crítica: POST com SELECT FOR UPDATE (anti-overbooking).
        Peso 2 — moderado; é escrita com lock no banco.
        """
        if not self.id_paciente or not self.id_escala:
            return

        from datetime import date, timedelta
        data_alvo = (date.today() + timedelta(days=random.randint(1, 14))).isoformat()

        with self.client.post(
            "/agendamentos/",
            json={
                "id_paciente": self.id_paciente,
                "id_escala": self.id_escala,
                "data_agendamento": data_alvo,
                "hora_vaga": "08:00:00"
            },
            headers=self._headers(),
            name="[C3] POST /agendamentos/",
            catch_response=True
        ) as resp:
            if resp.status_code == 201:
                body = resp.json()
                self.id_item_agenda = body.get("id_item", "")
            elif resp.status_code in (404, 409, 422):
                # Sem slot disponível ou horário já ocupado — comportamento esperado
                resp.success()
            else:
                resp.failure(f"Reserva falhou: {resp.status_code} — {resp.text[:100]}")

    # ─── TASK 4: Check-in na recepção (peso 2) ────────────────────────────────
    @task(2)
    def cenario_checkin_recepcao(self):
        """
        PATCH de status: 'M' (Marcado) → 'A' (Chegou). Fim do fluxo de sucesso.
        Peso 2 — frequente no horário de pico da UBS (manhã).
        """
        if not self.id_item_agenda:
            return

        with self.client.patch(
            f"/agendamentos/{self.id_item_agenda}/status",
            json={"novo_status": "A"},
            headers=self._headers(),
            name="[C4] PATCH /agendamentos/{id}/status",
            catch_response=True
        ) as resp:
            if resp.status_code in (200, 404, 422):
                resp.success()
            else:
                resp.failure(f"Check-in falhou: {resp.status_code}")

    # ─── TASK 5: Cadastro de paciente (peso 1) ────────────────────────────────
    @task(1)
    def cenario_cadastro_paciente(self):
        """
        POST de paciente novo com LGPD obrigatório.
        Peso 1 — menos frequente; é a operação mais pesada (Argon2 hash).
        """
        from datetime import datetime

        cpf_aleatorio = str(random.randint(10000000000, 99999999999))

        with self.client.post(
            "/pacientes/",
            json={
                "id_municipio": self.id_municipio,
                "id_ubs_referencia": self.id_ubs,
                "cpf": cpf_aleatorio,
                "celular": "31999999999",
                "aceitou_lgpd": True,
                "dt_aceite_lgpd": datetime.utcnow().isoformat()
            },
            headers=self._headers(),
            name="[C5] POST /pacientes/",
            catch_response=True
        ) as resp:
            if resp.status_code in (201, 409, 422):
                # 409 = CPF duplicado (esperado em carga), 422 = validação
                resp.success()
            else:
                resp.failure(f"Cadastro falhou: {resp.status_code} — {resp.text[:150]}")


# ─────────────────────────────────────────────
# HOOKS DE RELATÓRIO
# ─────────────────────────────────────────────
@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Imprime um resumo ao final do teste no terminal."""
    stats = environment.stats

    print("\n" + "─" * 65)
    print("  📊  RELATÓRIO FINAL — LOAD TEST SaaS AGENDAMENTO APS")
    print("─" * 65)
    print(f"  {'CENÁRIO':<40} {'RPS':>6}  {'P95':>8}  {'ERROS':>6}")
    print("─" * 65)

    for name, entry in sorted(stats.entries.items()):
        rps    = f"{entry.current_rps:.1f}"
        p95    = f"{entry.get_response_time_percentile(0.95):.0f}ms" if entry.num_requests > 0 else "—"
        erros  = f"{entry.num_failures}"
        label  = name[1] if isinstance(name, tuple) else str(name)
        label  = label[:40]
        print(f"  {label:<40} {rps:>6}  {p95:>8}  {erros:>6}")

    total   = stats.total
    ok_pct  = 100 - (total.fail_ratio * 100) if total.num_requests > 0 else 0
    verdict = "✅ APROVADO" if ok_pct >= 99 else "❌ REPROVADO"

    print("─" * 65)
    print(f"  Total de Requisições : {total.num_requests}")
    print(f"  Taxa de Sucesso      : {ok_pct:.1f}%")
    print(f"  P95 Global           : {total.get_response_time_percentile(0.95):.0f}ms")
    print(f"  Veredicto            : {verdict}")
    print("─" * 65 + "\n")
