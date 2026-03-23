from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
from database import engine, get_db
from cadsus_service import CADSUSService

cadsus = CADSUSService()

# Inicia o FastAPI
app = FastAPI(title="Plataforma de Regulação SUS - API")

@app.get("/")
def home():
    return {"status": "Online", "msg": "API de Regulação ativa"}

@app.get("/solicitacoes/pendentes")
def listar_pendentes(db: Session = Depends(get_db)):
    # O .join traz os dados do paciente junto com a solicitação
    resultados = db.query(models.Solicitacao).filter(
        models.Solicitacao.status == "AGUARDANDO_ROBO"
    ).all()
    
    return [
        {
            "id": s.id,
            "paciente_nome": s.paciente.nome_completo,
            "paciente_cpf": s.paciente.cpf,
            "paciente_cns": s.paciente.cns,
            "paciente_nascimento": s.paciente.data_nascimento.strftime("%d/%m/%Y"),
            "prioridade": s.prioridade,
            "justificativa": s.justificativa,
            "municipio": s.cliente.nome_municipio,
            # Importante para o robô saber qual login usar:
            "sisreg_login": s.cliente.sisreg_login 
        } for s in resultados
    ]

# Rota para o Robô atualizar o status após o agendamento no SISREG
@app.patch("/solicitacoes/{id}/sucesso")
def marcar_sucesso(id: str, protocolo: str, db: Session = Depends(get_db)):
    solicitacao = db.query(models.Solicitacao).filter(models.Solicitacao.id == id).first()
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    solicitacao.status = "AGENDADO_SISREG"
    solicitacao.protocolo_sisreg = protocolo
    db.commit()
    return {"msg": "Status atualizado com sucesso"}

@app.post("/pacientes/validar-cadsus/{cpf}")
async def validar_e_cadastrar(cpf: str, cliente_id: str, db: Session = Depends(get_db)):
    # 1. Consulta no Simulador (Mock)
    dados_governo = cadsus.consultar_por_cpf(cpf)
    
    if not dados_governo:
        raise HTTPException(status_code=404, detail="Paciente não encontrado na base federal")
    
    # 2. Verifica se o paciente já existe para não duplicar
    existente = db.query(models.Paciente).filter(models.Paciente.cpf == cpf).first()
    if existente:
        return {"msg": "Paciente já cadastrado", "nome": existente.nome_completo}

    # 3. Salva no Banco Multi-Tenant
    novo_paciente = models.Paciente(
        nome_completo=dados_governo.nome,
        cpf=cpf,
        cns=dados_governo.cns,
        data_nascimento=dados_governo.dataNascimento,
        cliente_id=cliente_id # Usa o ID da prefeitura que enviamos
    )
    
    db.add(novo_paciente)
    db.commit()
    
    return {"msg": "Paciente importado com sucesso!", "nome": novo_paciente.nome_completo}