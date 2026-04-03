from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, date, time, timedelta, timezone 
import models
from database import engine, get_db
from cadsus_service import CADSUSService
from fastapi.security import OAuth2PasswordRequestForm
from auth import verificar_senha, criar_token_acesso, get_usuario_logado, oauth2_scheme

cadsus = CADSUSService()
app = FastAPI(title="SaaS Agendamento APS - API")

# ==========================================
# FUNÇÕES AUXILIARES
# ==========================================
def somar_minutos(horario: time, minutos: int) -> time:
    """Função utilitária para fatiar os slots de tempo."""
    data_falsa = date(2000, 1, 1)
    dt_completa = datetime.combine(data_falsa, horario) + timedelta(minutes=minutos)
    return dt_completa.time()

# ==========================================
# SCHEMAS (Pydantic) PARA RECEBER DADOS
# ==========================================
class CadastroPacienteApp(BaseModel):
    id_municipio: str
    id_ubs_referencia: str
    celular: str
    aceitou_lgpd: bool

class NovoAgendamentoApp(BaseModel):
    id_paciente: str
    id_escala: str
    data_agendamento: date
    hora_vaga: time

class AtualizaStatusAgendamento(BaseModel):
    novo_status: str # 'A' (Chegou), 'F' (Faltou), 'C' (Cancelado)

# ==========================================
# ROTAS DO SISTEMA
# ==========================================

@app.get("/")
def home():
    return {"status": "Online", "msg": "Motor de Agendamento APS Ativo"}

@app.get("/especialidades")
def listar_especialidades(db: Session = Depends(get_db)):
    """Retorna as especialidades disponíveis para a App do Cidadão"""
    especialidades = db.query(models.Especialidade).filter(
        models.Especialidade.is_livre_demanda == True
    ).all()
    return [{"id_especialidade": e.id_especialidade, "nome": e.nome} for e in especialidades]

@app.get("/agendas/disponiveis")
def listar_vagas_disponiveis(id_ubs: str, id_especialidade: str, db: Session = Depends(get_db)):
    """Fatia o intervalo (hr_inicio a hr_fim) baseado no tempo_medio_min e retorna apenas slots livres."""
    escalas = db.query(models.EscalaCentral).filter(
        models.EscalaCentral.id_ubs == id_ubs,
        models.EscalaCentral.id_especialidade == id_especialidade
    ).all()

    slots_livres = []
    for escala in escalas:
        hora_atual = escala.hr_inicio
        medico = db.query(models.Profissional).filter(models.Profissional.id_profissional == escala.id_profissional).first()

        while hora_atual < escala.hr_fim:
            slot_ocupado = db.query(models.ItAgendaCentral).join(models.AgendaCentral).filter(
                models.AgendaCentral.id_escala == escala.id_escala,
                models.ItAgendaCentral.hr_agenda == hora_atual,
                models.ItAgendaCentral.tp_situacao.in_(['M', 'A']) 
            ).first()

            if not slot_ocupado:
                slots_livres.append({
                    "id_escala": escala.id_escala,
                    "medico": medico.nome if medico else "Médico não alocado",
                    "hora_vaga": hora_atual.strftime("%H:%M")
                })
            
            hora_atual = somar_minutos(hora_atual, escala.tempo_medio_min)

    return {"total_vagas": len(slots_livres), "vagas": slots_livres}

@app.post("/pacientes/validar-cadsus/{cpf}")
def validar_e_cadastrar_paciente(cpf: str, dados: CadastroPacienteApp, db: Session = Depends(get_db)):
    """Integração CAD SUS (Módulo BFF) e Registo com Trava LGPD."""
    if not dados.aceitou_lgpd:
        raise HTTPException(status_code=403, detail="O aceite do Termo de Consentimento LGPD é obrigatório.")

    dados_governo = cadsus.consultar_por_cpf(cpf)
    if not dados_governo:
        raise HTTPException(status_code=502, detail="Serviço indisponível. Preencha os dados manualmente.")
    
    existente = db.query(models.Paciente).filter(models.Paciente.nr_cpf == cpf).first()
    if existente:
        return {"msg": "Paciente já cadastrado.", "nome": existente.nm_paciente}

    novo_paciente = models.Paciente(
        id_municipio=dados.id_municipio,
        id_ubs_referencia=dados.id_ubs_referencia,
        nr_cpf=cpf,
        nr_cns=dados_governo.cns,
        nm_paciente=dados_governo.nome,
        dt_nascimento=dados_governo.dataNascimento,
        tp_sexo="I", 
        contato={"celular": dados.celular},
        is_validado_sus=True,
        # Ajustado para evitar o Warning do Python 3.14
        dt_aceite_lgpd=datetime.now(timezone.utc) 
    )
    
    db.add(novo_paciente)
    db.commit()
    db.refresh(novo_paciente)
    
    return {"msg": "Paciente cadastrado!", "id_paciente": novo_paciente.id_paciente, "nome": novo_paciente.nm_paciente}

@app.post("/agendamentos")
def realizar_agendamento(dados: NovoAgendamentoApp, db: Session = Depends(get_db)):
    """Transação de Reserva com Trava Anti-Overbooking e Trava de Absenteísmo Automática."""
    
    # --- NOVO: Trava de Absenteísmo ---
    paciente = db.query(models.Paciente).filter(models.Paciente.id_paciente == dados.id_paciente).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
        
    municipio = db.query(models.Municipio).filter(models.Municipio.id_municipio == paciente.id_municipio).first()
    
    if municipio and municipio.config_absenteismo:
        limite_faltas = municipio.config_absenteismo.get("faltas_limite", 3)
        faltas_cometidas = db.query(models.ItAgendaCentral).filter(
            models.ItAgendaCentral.id_paciente == dados.id_paciente,
            models.ItAgendaCentral.tp_situacao == 'F'
        ).count()
        
        if faltas_cometidas >= limite_faltas:
            raise HTTPException(
                status_code=403, 
                detail=f"Bloqueio por absenteísmo: O utente excedeu o limite de {limite_faltas} faltas."
            )
    # ----------------------------------

    # Trava de Overbooking (LOCK)
    agenda_dia = db.query(models.AgendaCentral).filter(
        models.AgendaCentral.id_escala == dados.id_escala,
        models.AgendaCentral.dt_agenda == dados.data_agendamento
    ).with_for_update().first()

    if not agenda_dia:
        agenda_dia = models.AgendaCentral(id_escala=dados.id_escala, dt_agenda=dados.data_agendamento)
        db.add(agenda_dia)
        db.flush() 
        
    slot_ocupado = db.query(models.ItAgendaCentral).filter(
        models.ItAgendaCentral.id_agenda == agenda_dia.id_agenda,
        models.ItAgendaCentral.hr_agenda == dados.hora_vaga,
        models.ItAgendaCentral.tp_situacao.in_(['M', 'A'])
    ).first()
    
    if slot_ocupado:
        raise HTTPException(status_code=409, detail="Horário reservado por outro utente.")

    novo_slot = models.ItAgendaCentral(
        id_agenda=agenda_dia.id_agenda,
        hr_agenda=dados.hora_vaga,
        id_paciente=dados.id_paciente,
        tp_situacao='M'
    )
    
    db.add(novo_slot)
    db.commit() 
    
    return {"msg": "Agendamento confirmado!", "id_item": novo_slot.id_item, "status": novo_slot.tp_situacao}

# --- NOVO: Ação da Receção ---
@app.patch("/agendamentos/{id_item}/status")
def atualizar_status_recepcao(
    id_item: str, 
    dados: AtualizaStatusAgendamento, 
    db: Session = Depends(get_db),
    usuario = Depends(get_usuario_logado) 
):
    """Operação protegida da Recepção da UBS."""
    slot = db.query(models.ItAgendaCentral).filter(models.ItAgendaCentral.id_item == id_item).first()
    
    if not slot:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        
    slot.tp_situacao = dados.novo_status
    db.commit()
    db.refresh(slot)
    
    # Dicionário de mensagens de volta para melhorar o feedback na recepção
    mensagens = {
        'A': "Check-in realizado! Paciente aguardando atendimento.",
        'F': "Falta registrada. O histórico de absenteísmo foi atualizado.",
        'C': "Agendamento cancelado com sucesso."
    }
    
    return {
        "msg": mensagens.get(dados.novo_status, "Status atualizado"), 
        "novo_status": slot.tp_situacao,
        "executor": usuario["sub"]
    }

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Busca o profissional pelo CPF (que o OAuth2 envia no campo 'username')
    profissional = db.query(models.Profissional).filter(
        models.Profissional.cpf == form_data.username
    ).first()

    # 2. Valida existência e senha
    if not profissional or not verificar_senha(form_data.password, profissional.senha_hash):
        raise HTTPException(status_code=401, detail="CPF ou senha incorretos")

    # 3. O "Pulo do Gato" Multi-tenant: Colocamos os IDs no Token
    dados_token = {
        "sub": profissional.cpf,
        "id_profissional": str(profissional.id_profissional),
        "id_municipio": str(profissional.id_municipio)
    }
    
    token = criar_token_acesso(dados_token)
    return {"access_token": token, "token_type": "bearer"}

@app.get("/agenda-medica/hoje")
def listar_minha_agenda(db: Session = Depends(get_db), usuario = Depends(get_usuario_logado)):
    """Retorna os pacientes do dia para o médico que está logado."""
    hoje = date.today()
    id_medico = usuario["id_profissional"]
    
    pacientes = db.query(models.ItAgendaCentral).join(models.AgendaCentral).join(models.EscalaCentral).filter(
        models.EscalaCentral.id_profissional == id_medico,
        models.AgendaCentral.dt_agenda == hoje
    ).all()
    
    return {
        "medico_id": id_medico,
        "data": hoje,
        "pacientes": [
            {"hora": p.hr_agenda, "paciente_id": p.id_paciente, "status": p.tp_situacao} 
            for p in pacientes
        ]
    }