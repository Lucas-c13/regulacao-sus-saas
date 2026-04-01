from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, date, time, timedelta
import models
from database import engine, get_db
from cadsus_service import CADSUSService

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
        dt_aceite_lgpd=datetime.utcnow() 
    )
    
    db.add(novo_paciente)
    db.commit()
    db.refresh(novo_paciente)
    
    return {"msg": "Paciente registado!", "id_paciente": novo_paciente.id_paciente, "nome": novo_paciente.nm_paciente}

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
def atualizar_status_recepcao(id_item: str, dados: AtualizaStatusAgendamento, db: Session = Depends(get_db)):
    """Operação da Receção da UBS para alterar o ciclo de vida do agendamento."""
    if dados.novo_status not in ['A', 'F', 'C']:
        raise HTTPException(status_code=400, detail="Status inválido. Use 'A' (Chegou), 'F' (Faltou) ou 'C' (Cancelado).")
        
    slot = db.query(models.ItAgendaCentral).filter(models.ItAgendaCentral.id_item == id_item).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        
    slot.tp_situacao = dados.novo_status
    db.commit()
    db.refresh(slot)
    
    mensagens = {
        'A': "Check-in realizado! Paciente a aguardar atendimento na UBS.",
        'F': "Falta ('No-Show') registada. A regra de absenteísmo foi alimentada.",
        'C': "Agendamento cancelado. A vaga voltou a ficar livre na App do cidadão."
    }
    
    return {"msg": mensagens[dados.novo_status], "novo_status": slot.tp_situacao}