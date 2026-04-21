import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Edit2, 
  KeyRound, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  UserX, 
  AlertTriangle, 
  UserPlus
} from 'lucide-react';
import { formatarCPF, formatarData, formatarCNS } from '../../utils/formatters';

// Shared Components
import { PremiumHeader } from '../../shared/components/PremiumHeader';
import { Modal } from '../../shared/components/Modal';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

interface Paciente {
  id_paciente: string;
  nm_paciente: string;
  nr_cpf: string | null;
  nr_cns: string | null;
  dt_nascimento: string | null;
  contato: { celular?: string } | null;
  is_validado_sus: boolean;
  sn_ativo: boolean;
  faltas_ativas: number;
}

export default function ListaPacientes() {
  const { ubsAtiva } = useAuth();
  const navigate = useNavigate();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');

  // Modal Edição State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pacienteEdit, setPacienteEdit] = useState<Paciente | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCelular, setEditCelular] = useState('');
  const [editStatus, setEditStatus] = useState(true);

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
    if (!window.confirm(`Isenção de Falta: Deseja justificar administrativamente as faltas ativas de ${nome}?`)) return;
    try {
      const res = await api.patch(`/pacientes/${id_paciente}/desbloquear`);
      setSucesso(res.data.mensagem || 'Paciente desbloqueado com sucesso.');
      carregarPacientes();
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao desbloquear paciente.');
    }
  };

  const handleResetarSenha = async (id_paciente: string, nome: string) => {
    if (!window.confirm(`Esquecimento de Senha: Deseja redefinir a senha de ${nome}?`)) return;
    try {
      const senhaForcada = "AcessoSUS123";
      await api.put(`/pacientes/${id_paciente}`, { nova_senha: senhaForcada });
      setSucesso(`Senha provisória gerada para ${nome}: ${senhaForcada}`);
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao redefinir senha.');
    }
  };

  const abrirModalEdicao = (p: Paciente) => {
    setPacienteEdit(p);
    setEditNome(p.nm_paciente);
    setEditCelular(p.contato?.celular || '');
    setEditStatus(p.sn_ativo);
    setIsEditModalOpen(true);
  };

  const handleSalvarEdicao = async () => {
    if (!pacienteEdit) return;
    try {
      await api.put(`/pacientes/${pacienteEdit.id_paciente}`, {
        nm_paciente: editNome,
        celular: editCelular,
        sn_ativo: editStatus
      });
      setSucesso(`Cidadão ${editNome} atualizado com sucesso!`);
      setIsEditModalOpen(false);
      carregarPacientes();
    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao editar dados.');
    }
  };

  const pacientesFiltrados = pacientes.filter(p => 
    p.nm_paciente?.toLowerCase().includes(busca.toLowerCase()) ||
    (p.nr_cpf && p.nr_cpf.includes(busca.replace(/\D/g, ''))) ||
    (p.nr_cns && p.nr_cns.includes(busca.replace(/\D/g, '')))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      
      <PremiumHeader 
        icon={Users}
        title="Manutenção de Cidadãos"
        subtitle="Localize registros, edite dados, justifique absenteísmos e controle permissões."
        action={
          <button 
            onClick={() => navigate('/recepcao/pacientes/novo')}
            className="flex items-center space-x-2 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all w-full md:w-auto justify-center"
          >
            <UserPlus size={20} />
            <span>Novo Cidadão</span>
          </button>
        }
      />

      {sucesso && (
        <div className="bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500 p-5 rounded-r-2xl flex items-center shadow-sm animate-in slide-in-from-top-2">
          <CheckCircle2 className="mr-3 flex-shrink-0" size={28} />
          <span className="font-bold">{sucesso}</span>
          <button onClick={() => setSucesso('')} className="ml-auto text-emerald-600 font-bold text-sm">Dispensar</button>
        </div>
      )}

      {erro && (
        <div className="bg-red-50 text-red-800 border-l-4 border-red-500 p-5 rounded-r-2xl flex items-center shadow-sm animate-in shake">
          <AlertTriangle className="mr-3 flex-shrink-0" size={28} />
          <span className="font-bold">{erro}</span>
          <button onClick={() => setErro('')} className="ml-auto text-red-600 font-bold text-sm">Dispensar</button>
        </div>
      )}

      {/* Busca Master */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-4">
        <div className="relative flex-1 group">
          <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Pesquisar por Nome, CPF ou Cartão SUS..." 
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-primary/20 hover:border-primary/50 text-lg font-medium transition-all"
          />
        </div>
        <div className="hidden md:flex flex-col items-center justify-center bg-primary/5 px-6 py-3 rounded-2xl border border-primary/10 h-full min-w-[120px]">
           <span className="text-3xl font-black text-primary leading-none">{pacientesFiltrados.length}</span>
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registros</span>
        </div>
      </div>

      {/* Listagem */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
        {carregando ? (
          <LoadingSpinner label="Buscando base de cidadãos..." className="py-20" />
        ) : pacientesFiltrados.length === 0 ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center">
            <UserX size={64} className="mb-6 opacity-20" />
            <h3 className="text-xl font-bold text-slate-700">Nenhum cidadão localizado</h3>
            <p className="mt-2 text-sm font-medium">Tente outros termos ou realize um novo cadastro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                  <th className="p-6">Identificação Principal</th>
                  <th className="p-6">CPF / Cartão SUS</th>
                  <th className="p-6">Status Punitivo</th>
                  <th className="p-6">Validação SUS</th>
                  <th className="p-6 text-right w-48">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pacientesFiltrados.map((p) => (
                  <tr key={p.id_paciente} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{p.nm_paciente}</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                          Nascimento: {formatarData(p.dt_nascimento)}
                        </span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase w-8">CPF:</span>
                           <span className="font-mono text-sm font-bold text-slate-700 tracking-wider">
                             {p.nr_cpf ? formatarCPF(p.nr_cpf) : 'Não Cadastrado'}
                           </span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase w-8">CNS:</span>
                           <span className="font-mono text-xs font-semibold text-slate-500 tracking-widest">
                             {p.nr_cns ? formatarCNS(p.nr_cns) : 'Não Cadastrado'}
                           </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                        {p.faltas_ativas > 0 ? (
                           <div className="flex flex-col gap-1">
                             <StatusBadge label="BLOQUEADO" type="danger" />
                             <span className="text-[10px] font-bold text-red-500 uppercase ml-1">{p.faltas_ativas} falta(s) pendente(s)</span>
                           </div>
                        ) : (
                           <StatusBadge label="REGULAR" type="success" />
                        )}
                    </td>
                    <td className="p-6">
                        <div className="flex flex-col gap-1.5">
                           <StatusBadge 
                             label={p.sn_ativo ? "Conta Ativa" : "Inativado"} 
                             type={p.sn_ativo ? "success" : "neutral"} 
                           />
                           {p.is_validado_sus ? (
                             <div className="flex items-center text-emerald-600 gap-1 ml-1">
                               <ShieldCheck size={14} />
                               <span className="text-[10px] font-bold uppercase">Base Nacional SUS</span>
                             </div>
                           ) : (
                             <div className="flex items-center text-amber-600 gap-1 ml-1">
                               <AlertTriangle size={14} />
                               <span className="text-[10px] font-bold uppercase">Pendente Validação</span>
                             </div>
                           )}
                        </div>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2">
                         <button onClick={() => abrirModalEdicao(p)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl border border-slate-200 transition-all shadow-sm" title="Editar">
                           <Edit2 size={18} />
                         </button>
                         <button onClick={() => handleResetarSenha(p.id_paciente, p.nm_paciente)} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl border border-slate-200 transition-all shadow-sm" title="Resetar Senha">
                           <KeyRound size={18} />
                         </button>
                         {p.faltas_ativas > 0 && (
                           <button onClick={() => handleJustificarFaltas(p.id_paciente, p.nm_paciente)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl border border-red-200 transition-all shadow-sm animate-pulse" title="Perdoar Faltas">
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

      {/* Modal de Edição */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Cidadão"
        subtitle="Ajuste as informações cadastrais e o status de acesso."
        icon={Edit2}
        footer={
          <>
            <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
            <button onClick={handleSalvarEdicao} className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Salvar Alterações</button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
            <input 
              type="text" 
              value={editNome} 
              onChange={e => setEditNome(e.target.value)} 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Celular de Contato</label>
            <input 
              type="text" 
              value={editCelular} 
              onChange={e => setEditCelular(e.target.value)} 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="pt-2">
            <label className={`flex items-center space-x-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${editStatus ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={editStatus} onChange={e => setEditStatus(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </div>
              <div>
                <span className={`font-black text-sm ${editStatus ? 'text-emerald-700' : 'text-slate-600'}`}>{editStatus ? 'Conta Ativa' : 'Conta Suspensa'}</span>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Status de permissão para agendamentos</p>
              </div>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
