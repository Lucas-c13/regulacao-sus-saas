import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/AuthContext';
import { Users, Search, CalendarPlus, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

interface Escala {
  id_escala: string;
  hr_inicio: string;
  hr_fim: string;
  tp_dia_semana: number;
  tempo_medio_min: number;
}

interface SlotDisponivel {
  hora: string;
  disponivel: boolean;
}

const DIAS_SEMANA: Record<number, string> = {
  1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 7: 'Dom'
};

export default function NovoAgendamento() {
  const { ubsAtiva, userPayload } = useAuth();
  
  const [cpf, setCpf] = useState('');
  const [idPaciente, setIdPaciente] = useState('');
  const [pacienteValido, setPacienteValido] = useState(false);
  
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [idEscalaSelecionada, setIdEscalaSelecionada] = useState('');
  const [dataConsulta, setDataConsulta] = useState(new Date().toISOString().split('T')[0]);
  
  const [slots, setSlots] = useState<SlotDisponivel[]>([]);
  const [processando, setProcessando] = useState(false);
  const [carregandoSlots, setCarregandoSlots] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');

  const cpfLimpo = cpf.replace(/\D/g, '');

  const formatarCPF = (valor: string) => {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    return nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  // Carrega escalas da UBS ativa
  useEffect(() => {
    const carregarEscalas = async () => {
      if (!ubsAtiva) return;
      try {
        const res = await api.get(`/escalas/?id_ubs=${ubsAtiva}`);
        if (Array.isArray(res.data) && res.data.length > 0) {
          setEscalas(res.data);
          setIdEscalaSelecionada(res.data[0].id_escala);
        } else {
          setEscalas([]);
        }
      } catch (e) {
        console.error('Erro ao carregar escalas', e);
      }
    };
    carregarEscalas();
  }, [ubsAtiva]);

  // Carrega slots quando escala ou data muda (e paciente validado)
  useEffect(() => {
    if (pacienteValido && idEscalaSelecionada && dataConsulta) {
      carregarSlots();
    }
  }, [idEscalaSelecionada, dataConsulta, pacienteValido]);

  const carregarSlots = async () => {
    if (!idEscalaSelecionada) return;
    setCarregandoSlots(true);
    setErro('');
    try {
      const response = await api.get('/agendamentos/disponiveis', {
        params: {
          id_escala: idEscalaSelecionada,
          data_consulta: dataConsulta,
        }
      });
      const disponíveis = response.data.horarios_disponiveis || [];
      setSlots(disponíveis.map((h: string) => ({ hora: h, disponivel: true })));
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Nenhuma escala configurada para esta data.';
      setErro(msg);
      setSlots([]);
    } finally {
      setCarregandoSlots(false);
    }
  };

  const handleValidarPaciente = async () => {
    setErro('');
    setPacienteValido(false);
    setSlots([]);
    setIdPaciente('');

    if (cpfLimpo.length !== 11) {
      setErro('CPF inválido. Informe os 11 dígitos.');
      return;
    }

    if (!userPayload?.tenant_id) {
      setErro('Sessão inválida. Faça login novamente.');
      return;
    }

    setProcessando(true);
    try {
      // Tenta validar/registrar via CADSUS
      const ubsRef = ubsAtiva || userPayload.tenant_id;
      const res = await api.post(`/pacientes/validar-cadsus/${cpfLimpo}`, {
        id_municipio: userPayload.tenant_id,
        id_ubs_referencia: ubsRef,
        cpf: cpfLimpo,
        celular: '',
        aceitou_lgpd: true,
        dt_aceite_lgpd: new Date().toISOString(),
      });

      if (res.data.id_paciente) {
        setIdPaciente(res.data.id_paciente);
      } else if (res.data.msg?.includes('já cadastrado')) {
        // Paciente já existe — busca o ID buscando pacientes com esse CPF (via endpoint futuro)
        // Por hora, armazena o CPF para uso direto
        setIdPaciente('__cpf__' + cpfLimpo);
      }
      setPacienteValido(true);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao validar cidadão. Verifique o CPF.');
    } finally {
      setProcessando(false);
    }
  };

  const handleMarcarAgendamento = async (hora: string) => {
    if (!ubsAtiva) {
      setErro('Selecione uma UBS no cabeçalho antes de agendar.');
      return;
    }
    if (!idEscalaSelecionada) {
      setErro('Nenhuma escala selecionada.');
      return;
    }
    
    setProcessando(true);
    setErro('');
    setSucesso('');

    try {
      await api.post('/agendamentos/', {
        id_paciente: idPaciente,
        id_escala: idEscalaSelecionada,
        data_agendamento: dataConsulta,
        hora_vaga: hora + ':00',
      });
      
      setSucesso(`Agendamento confirmado para ${dataConsulta} às ${hora}!`);
      setSlots([]);
      setPacienteValido(false);
      setCpf('');
      setIdPaciente('');
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Conflito de horário! Tente outro slot.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-primary/10 rounded-xl text-primary">
            <Users size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Novo Agendamento</h2>
            <p className="text-slate-500 font-medium">Pesquise o cidadão e reserve uma vaga com validação em tempo real.</p>
          </div>
        </div>
        {!ubsAtiva && (
          <span className="mt-4 md:mt-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-orange-100 text-orange-700">
            <ShieldAlert size={16} /> Selecione uma UBS no cabeçalho
          </span>
        )}
      </div>

      {sucesso && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-5 rounded-xl flex items-center space-x-3">
          <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={24} />
          <span className="font-bold">{sucesso}</span>
        </div>
      )}

      {erro && (
        <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3">
          <ShieldAlert className="text-red-500 flex-shrink-0" size={20} />
          <span className="font-semibold text-sm">{erro}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Coluna Esquerda: Dados do Agendamento */}
        <div className={`p-8 rounded-3xl border transition-all duration-300 ${pacienteValido ? 'bg-white border-gray-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
          <h3 className="text-lg font-bold text-slate-800 mb-6">Identificação do Cidadão</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">CPF</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={cpf} 
                  onChange={e => setCpf(formatarCPF(e.target.value))} 
                  disabled={pacienteValido}
                  className="w-full pl-4 pr-12 py-4 bg-white border border-slate-300 text-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-primary/20 text-xl font-black tracking-widest disabled:opacity-50"
                  placeholder="000.000.000-00" 
                  maxLength={14} 
                />
                <button 
                  onClick={handleValidarPaciente}
                  disabled={processando || pacienteValido || cpfLimpo.length < 11}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-300 transition-colors"
                >
                  {processando ? <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin"/> : <Search size={20} />}
                </button>
              </div>
            </div>

            {pacienteValido && (
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                <div>
                  <p className="text-xs text-emerald-600 font-bold uppercase">Cidadão Validado ✓</p>
                  <p className="text-emerald-800 font-medium text-sm">Dados CADSUS confirmados.</p>
                </div>
                <button onClick={() => { setPacienteValido(false); setSlots([]); setCpf(''); setIdPaciente(''); }}
                  className="text-xs font-bold bg-white px-3 py-1 text-red-500 border border-red-200 rounded-md hover:bg-red-50">
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Seleção de Escala e Data */}
          {pacienteValido && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Escala / Turno</label>
                <select 
                  value={idEscalaSelecionada} 
                  onChange={e => setIdEscalaSelecionada(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
                >
                  {escalas.length === 0 && <option value="">Nenhuma escala disponível nesta UBS</option>}
                  {escalas.map(esc => (
                    <option key={esc.id_escala} value={esc.id_escala}>
                      {DIAS_SEMANA[esc.tp_dia_semana]} · {esc.hr_inicio?.slice(0,5)}–{esc.hr_fim?.slice(0,5)} ({esc.tempo_medio_min} min)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Data da Consulta</label>
                <input 
                  type="date" 
                  value={dataConsulta} 
                  onChange={e => setDataConsulta(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
                />
              </div>

              <button onClick={carregarSlots} disabled={carregandoSlots || !idEscalaSelecionada}
                className="w-full py-3 border-2 border-primary text-primary font-bold rounded-xl hover:bg-primary/5 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50">
                <Clock size={18} />
                <span>{carregandoSlots ? 'Buscando horários...' : 'Buscar Horários Disponíveis'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Coluna Direita: Slots Disponíveis */}
        <div className={`p-8 rounded-3xl border transition-all duration-300 ${pacienteValido && slots.length > 0 ? 'bg-white border-blue-100 shadow-lg shadow-blue-500/10' : 'bg-slate-50 border-slate-200 opacity-50 grayscale pointer-events-none'}`}>
          <h3 className="text-lg font-bold text-primary mb-6 flex items-center space-x-2">
            <CalendarPlus size={24} />
            <span>Horários Disponíveis</span>
          </h3>

          {!pacienteValido ? (
            <p className="text-slate-400 font-medium text-center mt-10">Valide o cidadão para ver os horários.</p>
          ) : carregandoSlots ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-200 rounded-xl" />)}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhuma vaga disponível</p>
              <p className="text-sm">Tente outra data ou escala.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {slots.map((slot, i) => (
                <button 
                  key={i} 
                  disabled={!slot.disponivel || processando}
                  onClick={() => handleMarcarAgendamento(slot.hora)}
                  className={`p-4 rounded-xl border-2 font-bold transition-all text-center ${
                    !slot.disponivel 
                      ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60' 
                      : 'bg-white border-blue-200 text-blue-600 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md hover:scale-[1.02] active:scale-95'
                  }`}
                >
                  <span className="block text-2xl">{slot.hora}</span>
                  <span className="block text-[10px] uppercase mt-1">
                    {slot.disponivel ? 'RESERVAR' : 'OCUPADO'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
