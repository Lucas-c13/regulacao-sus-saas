import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/AuthContext';
import { Users, Search, Edit2, KeyRound, ShieldCheck, ShieldAlert, CheckCircle2, UserX, AlertTriangle } from 'lucide-react';

interface Paciente {
  id_paciente: string;
  nm_paciente: string;
  nr_cpf: string | null;
  nr_cns: string | null;
  contato: { celular?: string } | null;
  is_validado_sus: boolean;
  sn_ativo: boolean;
  faltas_ativas: number;
}

export default function ListaPacientes() {
  const { ubsAtiva, userRole } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');

  // Busca e Listagem Front-End Simples (Ideal para MVP. Depois recomenda-se Paginação pelo Servidor)
  const pacientesFiltrados = pacientes.filter(p => 
    p.nm_paciente?.toLowerCase().includes(busca.toLowerCase()) ||
    (p.nr_cpf && p.nr_cpf.includes(busca.replace(/\D/g, '')))
  );

  useEffect(() => {
    carregarPacientes();
  }, []);

  const carregarPacientes = async () => {
    setCarregando(true);
    setErro('');
    try {
      const res = await api.get('/pacientes/');
      setPacientes(res.data);
    } catch (err: any) {
      setErro('Erro ao buscar a listagem de pacientes desta prefeitura.');
    } finally {
      setCarregando(false);
    }
  };

  const handleJustificarFaltas = async (id_paciente: string, nome: string) => {
    if (!window.confirm(`Isenção de Falta: Deseja justificar administrativamente as faltas ativas de ${nome} e desbloquear o perfil para uso do Aplicativo Móvel?`)) return;
    setErro('');
    setSucesso('');
    try {
      const res = await api.patch(`/pacientes/${id_paciente}/desbloquear`);
      setSucesso(res.data.mensagem || 'Faltas justificadas e paciente desbloqueado com sucesso.');
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Tratativa falhou ou utente não possui faltas bloqueando o acesso.');
    }
  };

  const handleResetarSenha = async (id_paciente: string, nome: string) => {
    if (!window.confirm(`Esquecimento de Senha: Deseja forçar uma nova senha padrão de acesso para ${nome}? O cidadão será obrigado a trocar ao logar no app.`)) return;
    setErro('');
    setSucesso('');
    try {
      const senhaForcada = "AcessoSUS123";
      await api.put(`/pacientes/${id_paciente}`, { nova_senha: senhaForcada });
      setSucesso(`Senha provisória gerada com sucesso para ${nome}: ${senhaForcada}`);
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro crítico ao tentar redefinir senha do cidadão.');
    }
  };

  const formatarCPF = (valor: string | null) => {
    if (!valor) return 'N/A';
    return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Premium (Aesthetics Standard) */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
          <Users size={120} />
        </div>
        <div className="relative z-10 text-white flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
              <Users size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight drop-shadow-md">Manutenção de Cidadãos</h2>
              <p className="text-blue-100 font-semibold opacity-90 mt-1 max-w-xl leading-relaxed">
                Localize registros, emita relatórios, justifique o absenteísmo na atenção básica e apoie os acessos do aplicativo móvel.
              </p>
            </div>
          </div>
        </div>
      </div>

      {sucesso && (
        <div className="bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500 p-5 rounded-r-2xl flex items-center shadow-sm">
          <CheckCircle2 className="mr-3 flex-shrink-0" size={28} />
          <span className="font-bold">{sucesso}</span>
        </div>
      )}

      {erro && (
        <div className="bg-red-50 text-red-800 border-l-4 border-red-500 p-5 rounded-r-2xl flex flex-col md:flex-row items-start md:items-center shadow-sm justify-between">
          <div className="flex items-center">
            <AlertTriangle className="mr-3 flex-shrink-0" size={28} />
            <span className="font-bold">{erro}</span>
          </div>
          <button onClick={() => setErro('')} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 mt-2 md:mt-0 font-bold rounded">Dispensar</button>
        </div>
      )}

      {/* Caixa Master de Busca */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="relative flex-1 group">
          <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar paciente pelo nome completo ou documento..." 
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-primary/20 hover:border-primary/50 text-lg font-medium transition-all"
          />
        </div>
        <div className="hidden md:flex flex-col items-center justify-center bg-indigo-50 px-6 py-3 rounded-2xl border border-indigo-100 h-full min-w-[120px]">
           <span className="text-3xl font-black text-indigo-600 leading-none">{pacientesFiltrados.length}</span>
           <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Registros</span>
        </div>
      </div>

      {/* Tabela Interativa de Listagem */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col">
        {carregando ? (
          <div className="p-20 text-center flex flex-col items-center justify-center flex-1">
             <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
             <p className="text-slate-500 font-bold animate-pulse">Cruzando dados de cidadãos desta Instância...</p>
          </div>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center flex-1">
            <UserX size={64} className="mb-6 opacity-30 text-slate-600" />
            <h3 className="text-2xl font-bold text-slate-700">Nenhum cidadão localizado</h3>
            <p className="mt-2 text-base font-medium">Tente reduzir os parâmetros da sua busca ou cadastre um novo cidadão.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-black tracking-widest">
                  <th className="p-6">Nome Completo do Cidadão</th>
                  <th className="p-6">Documento Principal</th>
                  <th className="p-6">Status Punitivo</th>
                  <th className="p-6">Governança CADSUS</th>
                  <th className="p-6 text-right w-48">Apoio e Suporte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pacientesFiltrados.map((p) => (
                  <tr key={p.id_paciente} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm">{p.nm_paciente}</span>
                        <span className="text-[10px] font-mono text-slate-400 mt-1 uppercase truncate max-w-[250px]">ID_SYS: {p.id_paciente.split('-')[0]}***</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-700 tracking-wider text-sm">
                          {p.nr_cpf ? formatarCPF(p.nr_cpf) : p.nr_cns ? 'CNS: ' + p.nr_cns : 'DOC AUSENTE'}
                        </span>
                        {p.contato?.celular && (
                           <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Celular: {p.contato.celular}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-6">
                        {p.faltas_ativas > 0 ? (
                           <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 shadow-sm animate-pulse">
                              <ShieldAlert size={14} className="text-red-600 mr-2"/>
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-red-700 leading-none">BLOQUEADO</span>
                                <span className="text-[10px] font-bold text-red-500 uppercase mt-0.5">{p.faltas_ativas} Falta(s) Pendente(s)</span>
                              </div>
                           </div>
                        ) : (
                           <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                              <CheckCircle2 size={14} className="text-slate-400 mr-2"/>
                              <span className="text-xs font-bold text-slate-500">Regular</span>
                           </div>
                        )}
                    </td>
                    <td className="p-6">
                        {p.is_validado_sus ? (
                          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                             <ShieldCheck size={14} className="text-emerald-600 mr-2"/> 
                             <span className="text-xs font-bold text-emerald-700">Base Integrada</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200">
                             <AlertTriangle size={14} className="text-orange-600 mr-2"/> 
                             <span className="text-xs font-bold text-orange-700">Apenas Local</span>
                          </div>
                        )}
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => handleResetarSenha(p.id_paciente, p.nm_paciente)}
                            className="p-2.5 text-slate-400 bg-white hover:bg-indigo-50 hover:text-indigo-600 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-all hover:scale-105 active:scale-95" title="Emitir Senha Provisória do App">
                           <KeyRound size={18} />
                         </button>
                         {p.faltas_ativas > 0 && (
                           <button 
                              onClick={() => handleJustificarFaltas(p.id_paciente, p.nm_paciente)}
                              className="p-2.5 text-red-500 bg-red-50 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl border border-red-200 shadow-sm hover:shadow transition-all hover:scale-105 active:scale-95" title="Perdoar Absenteísmo (Justificar Faltas)">
                             <ShieldAlert size={18} />
                           </button>
                         )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
