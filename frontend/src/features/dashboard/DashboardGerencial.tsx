import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { Calendar, Users, TrendingUp, AlertTriangle, CalendarDays, Building2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

interface KpiResponse {
  filtro_temporal: { inicio: string; fim: string };
  kpis_globais: {
    total_vagas_disponiveis: number;
    total_faltas: number;
    taxa_absenteismo_global: number;
  };
  ranking_ofensores_ubs: Array<{
    id_ubs: string;
    nome_ubs: string;
    total_vagas: number;
    total_faltas: number;
    taxa_absenteismo_percentual: number;
  }>;
}

interface EscalasRes {
  total: number;
}

export default function DashboardGerencial() {
  const { ubsAtiva } = useAuth();

  const dataHoje = new Date();
  const primeiroDia = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = new Date(dataHoje.getFullYear(), dataHoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);
  
  const [kpis, setKpis] = useState<KpiResponse | null>(null);
  const [totalEscalas, setTotalEscalas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setErro('');
    try {
      const [resKpis, resEscalas] = await Promise.allSettled([
        api.get('/dashboard/kpis', { params: { data_inicio: dataInicio, data_fim: dataFim } }),
        ubsAtiva ? api.get(`/escalas/?id_ubs=${ubsAtiva}`) : Promise.resolve({ data: [] }),
      ]);

      if (resKpis.status === 'fulfilled') {
        setKpis(resKpis.value.data);
      } else {
        setErro('Erro ao obter métricas. Verifique as permissões de acesso.');
      }

      if (resEscalas.status === 'fulfilled') {
        const escalasData = resEscalas.value.data;
        setTotalEscalas(Array.isArray(escalasData) ? escalasData.length : 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [dataInicio, dataFim, ubsAtiva]);

  const globais = kpis?.kpis_globais;
  const vagas = globais?.total_vagas_disponiveis ?? 0;
  const faltas = globais?.total_faltas ?? 0;
  const ocupadas = vagas - faltas;
  const taxa = globais?.taxa_absenteismo_global ?? 0;

  const cardsInfo = [
    { title: 'Vagas Totais no Período', value: vagas, icon: <Calendar className="w-6 h-6 text-blue-500" />, color: 'bg-blue-50', textColor: 'text-blue-700' },
    { title: 'Atendimentos Realizados', value: Math.max(0, ocupadas), icon: <Users className="w-6 h-6 text-emerald-500" />, color: 'bg-emerald-50', textColor: 'text-emerald-700' },
    { title: 'Faltas Registradas', value: faltas, icon: <AlertTriangle className="w-6 h-6 text-red-500" />, color: 'bg-red-50', textColor: 'text-red-700' },
    { title: 'Taxa de Absenteísmo', value: `${taxa}%`, icon: <TrendingUp className="w-6 h-6 text-orange-500" />, color: 'bg-orange-50', textColor: 'text-orange-700' },
    { title: 'Escalas Ativas (UBS)', value: totalEscalas, icon: <CalendarDays className="w-6 h-6 text-purple-500" />, color: 'bg-purple-50', textColor: 'text-purple-700' },
  ];

  const chartData = kpis?.ranking_ofensores_ubs?.map(ubs => ({
    nome_ubs: ubs.nome_ubs.length > 15 ? ubs.nome_ubs.slice(0, 15) + '...' : ubs.nome_ubs,
    taxa_absenteismo_pct: ubs.taxa_absenteismo_percentual,
    nome_completo: ubs.nome_ubs,
  })) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header e Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Painel Gerencial</h2>
          <p className="text-slate-500 text-sm mt-1">Indicadores em tempo real da rede municipal de saúde</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-semibold transition-shadow"/>
          </div>
          <span className="text-slate-300 mt-5 font-bold">–</span>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-semibold transition-shadow"/>
          </div>
          <button onClick={fetchDashboard} disabled={loading}
            className="mt-5 p-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-50">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 font-medium flex items-center space-x-3">
          <AlertTriangle size={20} />
          <span>{erro}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-pulse">
          {[1,2,3,4,5].map(i => <div key={i} className="h-32 bg-white rounded-2xl shadow-sm border border-gray-100"/>)}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {cardsInfo.map((c, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-start space-y-3 transform hover:-translate-y-1 transition-all duration-300">
                <div className={`p-3 rounded-xl ${c.color}`}>
                  {c.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{c.title}</p>
                  <h3 className={`text-3xl font-black tracking-tight mt-1 ${c.textColor}`}>{c.value}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico + Diagnóstico */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center space-x-2">
                <Building2 size={20} className="text-primary" />
                <span>Top UBS por Taxa de Absenteísmo</span>
              </h3>
              <div className="h-[300px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="nome_ubs" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                      <Tooltip 
                        cursor={{ fill: '#F8FAFC' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: any, _: any, props: any) => [`${val}%`, props.payload.nome_completo]}
                        labelFormatter={() => 'Taxa de Absenteísmo'}
                      />
                      <Bar dataKey="taxa_absenteismo_pct" radius={[6, 6, 0, 0]} maxBarSize={80}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.taxa_absenteismo_pct >= 30 ? '#EF4444' : '#F97316'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <TrendingUp className="w-10 h-10 text-slate-300 mb-2" />
                    <span className="font-medium text-sm">Sem faltas registradas neste período.</span>
                    <span className="text-xs mt-1">Crie escalas e realize agendamentos para ver os dados.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Diagnóstico */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Diagnóstico do Mês</h3>
              <div className="space-y-4 flex-1">
                
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide mb-1">Eficiência</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {vagas > 0 ? (100 - taxa).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">Taxa de comparecimento</p>
                </div>

                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1">Perdas</p>
                  <p className="text-2xl font-black text-red-600">{faltas} vagas</p>
                  <p className="text-xs text-red-500 mt-1">desperdiçadas por faltas</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-1">Produção</p>
                  <p className="text-2xl font-black text-blue-700">{Math.max(0, ocupadas)}</p>
                  <p className="text-xs text-blue-500 mt-1">atendimentos confirmados</p>
                </div>

                <div className="mt-auto pt-4">
                  <div className={`rounded-xl p-4 text-center ${taxa > 30 ? 'bg-red-900' : taxa > 15 ? 'bg-orange-900' : 'bg-slate-900'}`}>
                    <p className={`font-bold text-[10px] tracking-widest uppercase ${taxa > 30 ? 'text-red-300' : taxa > 15 ? 'text-orange-300' : 'text-emerald-400'}`}>
                      {taxa > 30 ? '🔴 ALERTA: Absenteísmo Crítico' : taxa > 15 ? '🟡 ATENÇÃO: Absenteísmo Moderado' : '🟢 Sistema Operando Normalmente'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
