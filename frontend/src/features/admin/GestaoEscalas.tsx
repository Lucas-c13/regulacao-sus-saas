import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { CalendarDays, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

export default function GestaoEscalas() {
  const { ubsAtiva, userRole } = useAuth();
  
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [idProfissional, setIdProfissional] = useState('');
  const [diaSemana, setDiaSemana] = useState('1'); // 1 = Segunda
  const [hrInicio, setHrInicio] = useState('08:00');
  const [hrFim, setHrFim] = useState('17:00');
  const [qtAtendimento, setQtAtendimento] = useState('20');
  
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // Carrega Profissionais (Apenas do Município Ativo graças ao Auth)
  useEffect(() => {
    const fetchProfissionais = async () => {
      try {
        const res = await api.get('/profissionais/municipio'); // Rota de Listagem
        if (Array.isArray(res.data)) {
            setProfissionais(res.data);
            if(res.data.length > 0) setIdProfissional(res.data[0].id_profissional);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchProfissionais();
  }, []);

  const handleSalvarEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso(false);
    
    if (!ubsAtiva) {
      setErro('Aviso: Tem de selecionar uma UBS no cabeçalho antes de gerir Escalas.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/escalas/central', {
        id_ubs: ubsAtiva,
        id_profissional: idProfissional,
        // Mock da especialidade para o MVP (Clínica Geral)
        id_especialidade: "a280e227-24a9-4089-a3cd-d6aab9001389", // Um ID dummy, se o backend falhar adaptaremos
        tp_dia_semana: parseInt(diaSemana),
        hr_inicio: hrInicio + ':00', // Format Time PostgreSQL
        hr_fim: hrFim + ':00',
        qt_atendimento: parseInt(qtAtendimento),
        tempo_medio_min: 15
      });

      setSucesso(true);
    } catch (err: any) {
      setErro(err.response?.data?.detail || "Erro ao validar/criar a matriz de Escala no Backend.");
    } finally {
      setLoading(false);
    }
  };

  const diasUteis = [
    { num: 1, nome: "Segunda-Feira" },
    { num: 2, nome: "Terça-Feira" },
    { num: 3, nome: "Quarta-Feira" },
    { num: 4, nome: "Quinta-Feira" },
    { num: 5, nome: "Sexta-Feira" },
    { num: 6, nome: "Sábado" }
  ];

  if(userRole !== 'admin_master' && userRole !== 'gestor_local') {
      return <div className="p-8 text-red-500 font-bold">Nível Insuficiente para Gerir Matrizes.</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary">
          <CalendarDays size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Matriz de Escalas</h2>
          <p className="text-slate-500 font-medium">Defina os Blocos Horários Mestre para o Motor de Agendamento</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        
        {sucesso && (
           <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl font-semibold text-center">
             Tudo pronto! A Rececionista já pode ver e marcar consultas para este dia da Semana!
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
                 {profissionais.length === 0 && <option value="">Sem profissionais gerados...</option>}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dia da Paramentação</label>
              <select value={diaSemana} onChange={e => setDiaSemana(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold">
                {diasUteis.map(d => (
                  <option key={d.num} value={d.num}>{d.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Capacidade Máxima (Vagas Totais)</label>
              <input type="number" value={qtAtendimento} onChange={e => setQtAtendimento(e.target.value)} required min={1} max={100}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-black text-blue-600"
                placeholder="Ex: 20" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide text-emerald-600">Entrada no Edifício</label>
              <input type="time" value={hrInicio} onChange={e => setHrInicio(e.target.value)} required
                className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-semibold" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide text-red-600">Fecho de Expediente</label>
              <input type="time" value={hrFim} onChange={e => setHrFim(e.target.value)} required
                className="w-full px-4 py-3 bg-red-50 border border-red-200 text-red-900 rounded-xl outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-semibold" />
            </div>

          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={loading}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50">
              <Save size={20} />
              <span>{loading ? 'A CONFIGURAR EIXO...' : 'ATIVAR MATRIZ NESTA UBS'}</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
