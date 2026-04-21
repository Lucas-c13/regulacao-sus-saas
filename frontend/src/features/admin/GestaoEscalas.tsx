import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { CalendarDays, Save, AlertTriangle, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

interface Profissional { id_profissional: string; nome: string; }
interface Especialidade { id_especialidade: string; nome: string; }
interface Escala {
  id_escala: string;
  id_profissional: string;
  id_especialidade: string;
  tp_dia_semana: number;
  hr_inicio: string;
  hr_fim: string;
  qt_atendimento: number;
  tempo_medio_min: number;
  sn_ativo: boolean;
}

const DIAS_SEMANA: Record<number, string> = {
  1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo'
};

export default function GestaoEscalas() {
  const { ubsAtiva, userRole } = useAuth();
  
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [escalasAtivas, setEscalasAtivas] = useState<Escala[]>([]);

  const [idProfissional, setIdProfissional] = useState('');
  const [idEspecialidade, setIdEspecialidade] = useState('');
  const [diaSemana, setDiaSemana] = useState('1');
  const [hrInicio, setHrInicio] = useState('08:00');
  const [hrFim, setHrFim] = useState('17:00');
  const [tempoMedioMin, setTempoMedioMin] = useState('15');
  const [disponivelApp, setDisponivelApp] = useState(true);
  const [bloqueiaFeriados, setBloqueiaFeriados] = useState(true);
  const [dtInicio, setDtInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dtFim, setDtFim] = useState('');
  const [dtDisponibilidade, setDtDisponibilidade] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(false);
  const [loadingEscalas, setLoadingEscalas] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const carregarEspecialidades = async () => {
    try {
      const res = await api.get('/especialidades/');
      if (Array.isArray(res.data)) {
        setEspecialidades(res.data);
        if (res.data.length > 0) setIdEspecialidade(res.data[0].id_especialidade);
      }
    } catch (e) { console.error('Erro ao carregar especialidades', e); }
  };

  const carregarProfissionais = async () => {
    try {
      const res = await api.get('/profissionais/municipio');
      if (Array.isArray(res.data)) {
        setProfissionais(res.data);
        if (res.data.length > 0) setIdProfissional(res.data[0].id_profissional);
      }
    } catch (e) { console.error('Erro ao carregar profissionais', e); }
  };

  const carregarEscalas = async () => {
    if (!ubsAtiva) return;
    setLoadingEscalas(true);
    try {
      const res = await api.get(`/escalas/?id_ubs=${ubsAtiva}`);
      if (Array.isArray(res.data)) setEscalasAtivas(res.data);
    } catch (e) { console.error('Erro ao carregar escalas', e); }
    finally { setLoadingEscalas(false); }
  };

  useEffect(() => {
    carregarProfissionais();
    carregarEspecialidades();
  }, []);

  useEffect(() => {
    carregarEscalas();
  }, [ubsAtiva]);

  const handleSalvarEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso(false);
    
    if (!ubsAtiva) {
      setErro('Selecione uma UBS no cabeçalho antes de criar escalas.');
      return;
    }
    if (!idProfissional || !idEspecialidade) {
      setErro('Selecione um profissional e uma especialidade.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/escalas/', {
        id_ubs: ubsAtiva,
        id_profissional: idProfissional,
        id_especialidade: idEspecialidade,
        tp_dia_semana: parseInt(diaSemana),
        dt_inicio: dtInicio,
        dt_fim: dtFim,
        dt_disponibilidade: dtDisponibilidade,
        hr_inicio: hrInicio + ':00',
        hr_fim: hrFim + ':00',
        tempo_medio_min: parseInt(tempoMedioMin),
        is_disponivel_app: disponivelApp,
        sn_bloqueia_feriados: bloqueiaFeriados,
      });
      setSucesso(true);
      carregarEscalas();
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao criar a escala. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDesativarEscala = async (id_escala: string) => {
    if (!confirm('Deseja desativar esta escala? Ela não gerará novas vagas.')) return;
    try {
      await api.patch(`/escalas/${id_escala}/desativar`);
      carregarEscalas();
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao desativar escala.');
    }
  };

  if (userRole !== 'admin_master' && userRole !== 'gestor_local') {
    return <div className="p-8 text-red-500 font-bold">Acesso restrito. Nível insuficiente para gerir escalas.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary">
          <CalendarDays size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Escalas</h2>
          <p className="text-slate-500 font-medium">
            {ubsAtiva ? `Gerindo escalas para a UBS selecionada` : '⚠️ Selecione uma UBS no cabeçalho'}
          </p>
        </div>
      </div>

      {/* Formulário de Criação */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Nova Escala</h3>

        {sucesso && (
          <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl flex items-center space-x-3">
            <CheckCircle2 className="text-emerald-500" />
            <span className="font-semibold">Escala criada com sucesso! A agenda já está disponível.</span>
          </div>
        )}

        {erro && (
          <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3">
            <AlertTriangle className="text-red-500" />
            <span className="font-semibold">{erro}</span>
          </div>
        )}

        <form onSubmit={handleSalvarEscala} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Profissional de Saúde</label>
              <select value={idProfissional} onChange={e => setIdProfissional(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold">
                {profissionais.map(p => (
                  <option key={p.id_profissional} value={p.id_profissional}>{p.nome}</option>
                ))}
                {profissionais.length === 0 && <option value="">Nenhum profissional cadastrado</option>}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Especialidade</label>
              <select value={idEspecialidade} onChange={e => setIdEspecialidade(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold">
                {especialidades.map(esp => (
                  <option key={esp.id_especialidade} value={esp.id_especialidade}>{esp.nome}</option>
                ))}
                {especialidades.length === 0 && <option value="">Carregando especialidades...</option>}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dia da Semana</label>
              <select value={diaSemana} onChange={e => setDiaSemana(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold">
                {Object.entries(DIAS_SEMANA).map(([num, nome]) => (
                  <option key={num} value={num}>{nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Horário de Início</label>
              <input type="time" value={hrInicio} onChange={e => setHrInicio(e.target.value)} required
                className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-semibold" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-red-600 uppercase tracking-wide">Horário de Fim</label>
              <input type="time" value={hrFim} onChange={e => setHrFim(e.target.value)} required
                className="w-full px-4 py-3 bg-red-50 border border-red-200 text-red-900 rounded-xl outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-semibold" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tempo por Consulta (min)</label>
              <input type="number" value={tempoMedioMin} onChange={e => setTempoMedioMin(e.target.value)} required min={5} max={120}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold text-blue-600"
                placeholder="Ex: 15" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Início do Ciclo</label>
              <input type="date" value={dtInicio} onChange={e => setDtInicio(e.target.value)} required
                className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-semibold" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-rose-600 uppercase tracking-wide">Fim do Ciclo</label>
              <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)} required
                className="w-full px-4 py-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/50 transition-all font-semibold" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-600 uppercase tracking-wide">Disponível para Público em:</label>
              <input type="date" value={dtDisponibilidade} onChange={e => setDtDisponibilidade(e.target.value)} required
                className="w-full px-4 py-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-semibold" />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-3 p-4 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
              <input type="checkbox" checked={disponivelApp} onChange={e => setDisponivelApp(e.target.checked)} className="w-5 h-5 text-primary rounded" />
              <div className="text-sm text-slate-600">
                <span className="font-bold text-slate-800 block">Disponível no App</span>
                Cidadãos podem agendar online.
              </div>
            </label>

            <label className="flex items-center space-x-3 p-4 bg-amber-50 rounded-xl border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors">
              <input type="checkbox" checked={bloqueiaFeriados} onChange={e => setBloqueiaFeriados(e.target.checked)} className="w-5 h-5 text-amber-600 rounded" />
              <div className="text-sm text-slate-600">
                <span className="font-bold text-slate-800 block">Respeitar Feriados</span>
                Agenda bloqueada automaticamente.
              </div>
            </label>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={loading || !ubsAtiva}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50">
              <Save size={20} />
              <span>{loading ? 'Criando escala...' : 'Criar Escala na UBS'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Escalas Ativas */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center space-x-2">
          <Clock size={20} className="text-primary" />
          <span>Escalas Ativas nesta UBS</span>
        </h3>
        
        {loadingEscalas ? (
          <div className="animate-pulse space-y-3">
            {[1,2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
          </div>
        ) : escalasAtivas.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma escala ativa nesta UBS.</p>
            <p className="text-sm">Crie a primeira escala no formulário acima.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {escalasAtivas.map(esc => {
              const prof = profissionais.find(p => p.id_profissional === esc.id_profissional);
              const esp = especialidades.find(e => e.id_especialidade === esc.id_especialidade);
              return (
                <div key={esc.id_escala} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-primary/30 transition-colors">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800">{prof?.nome || 'Profissional'}</p>
                    <p className="text-sm text-slate-500">
                      <span className="font-semibold text-primary">{DIAS_SEMANA[esc.tp_dia_semana]}</span>
                      {' · '}
                      {esc.hr_inicio?.slice(0,5)} – {esc.hr_fim?.slice(0,5)}
                      {' · '}
                      {esp?.nome || 'Especialidade'}
                      {' · '}
                      <span className="text-blue-600 font-semibold">{esc.tempo_medio_min} min/consulta</span>
                      {' · '}
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${esc.sn_bloqueia_feriados ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {esc.sn_bloqueia_feriados ? 'Bloqueia Feriados' : 'Livre em Feriados'}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold bg-white px-2 py-1 rounded inline-block mt-1 border border-slate-100">
                      Período: {new Date(esc.dt_inicio).toLocaleDateString('pt-BR')} até {new Date(esc.dt_fim).toLocaleDateString('pt-BR')} 
                      <span className="mx-2 text-slate-200">|</span> 
                      Reserva Abre: {new Date(esc.dt_disponibilidade).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button onClick={() => handleDesativarEscala(esc.id_escala)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Desativar escala">
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
