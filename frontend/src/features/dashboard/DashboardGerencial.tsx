import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { Calendar, Users, TrendingUp, AlertTriangle } from 'lucide-react';

export default function DashboardGerencial() {
  const dataHoje = new Date();
  const primeiroDia = new Date(dataHoje.getFullYear(), dataHoje.getMonth(), 1).toISOString().split('T')[0];
  const ultimoDia = new Date(dataHoje.getFullYear(), dataHoje.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim] = useState(ultimoDia);
  
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setErro('');
      try {
        const response = await api.get('/dashboard/kpis', {
          params: { data_inicio: dataInicio, data_fim: dataFim }
        });
        setKpis(response.data);
      } catch (err: any) {
        setErro('Erro ao obter métricas consolidadas. Verifique a chave Mestre.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [dataInicio, dataFim]);

  const cardsInfo = [
    { title: "Vagas Oferecidas", value: kpis?.total_vagas || 0, icon: <Calendar className="w-6 h-6 text-blue-500" />, color: "bg-blue-50" },
    { title: "Ocupação Real", value: kpis?.vagas_ocupadas || 0, icon: <Users className="w-6 h-6 text-emerald-500" />, color: "bg-emerald-50" },
    { title: "Faltas Totais", value: kpis?.total_faltas || 0, icon: <AlertTriangle className="w-6 h-6 text-red-500" />, color: "bg-red-50" },
    { title: "Taxa Municipal de Faltas", value: `${kpis?.taxa_absenteismo_geral_pct || 0}%`, icon: <TrendingUp className="w-6 h-6 text-orange-500" />, color: "bg-orange-50" }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header e Filtros Inteligentes */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Sala de Guerra (Indicadores)</h2>
          <p className="text-slate-500 text-sm mt-1">Análise de Desempenho em Tempo Real da Rede de Saúde</p>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Período Inicial</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-semibold transition-shadow"/>
          </div>
          <span className="text-slate-300 mt-5 font-bold">-</span>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Período Final</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-semibold transition-shadow"/>
          </div>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 font-medium">{erro}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white rounded-2xl shadow-sm border border-gray-100"></div>)}
        </div>
      ) : (
        <>
          {/* BENTO GRID: KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cardsInfo.map((c, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-5 transform hover:-translate-y-1 transition-all duration-300">
                <div className={`p-4 rounded-xl ${c.color}`}>
                  {c.icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{c.title}</p>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1">{c.value}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* Gráficos de Ofensores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* O Gráfico Matador */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Top UBS Infratoras (Taxa de Absenteísmo %)</h3>
              <div className="h-[320px] w-full">
                {kpis?.piores_ubs && kpis.piores_ubs.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kpis.piores_ubs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="nome_ubs" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                      <Tooltip 
                        cursor={{ fill: '#F8FAFC' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Bar dataKey="taxa_absenteismo_pct" radius={[6, 6, 0, 0]} maxBarSize={70}>
                         {kpis.piores_ubs.map((entry: any, index: number) => (
                           <Cell key={`cell-${index}`} fill={entry.taxa_absenteismo_pct >= 30 ? '#EF4444' : '#F97316'} 
                                 className="transition-all duration-300 hover:opacity-80"/>
                         ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <TrendingUp className="w-10 h-10 text-slate-300 mb-2" />
                    <span className="font-medium text-sm">Base de dados imaculada. Sem faltas neste período!</span>
                  </div>
                )}
              </div>
            </div>

            {/* Resumo Interpretativo */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
               <h3 className="text-lg font-bold text-slate-800 mb-6">Diagnóstico do Custo</h3>
               <div className="space-y-4 flex-1">
                 <div className="p-5 bg-red-50/50 rounded-xl border border-red-100">
                    <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Perdas Acumuladas</p>
                    <p className="text-2xl font-black text-red-600">{kpis?.total_faltas || 0} Vagas desperdiçadas</p>
                 </div>
                 <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Carga Absoluta</p>
                    <p className="text-2xl font-black text-blue-600">{kpis?.vagas_ocupadas} Atendimentos Seguros</p>
                 </div>
                 
                 <div className="pt-6 mt-auto">
                   <div className="bg-slate-900 rounded-xl p-4 text-center">
                     <p className="text-emerald-400 font-bold text-[10px] tracking-widest leading-relaxed uppercase">
                       A Integração SQL Engine PostgreSQL está Operante e o Isolamento Tenant Desativado Nível 1.
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
