import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { Users, Search, Activity, UserCog, KeyRound, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatarCPF } from '../../utils/formatters';

// Shared Components
import { PremiumHeader } from '../../shared/components/PremiumHeader';
import { Modal } from '../../shared/components/Modal';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner';

interface Profissional {
  id_profissional: string;
  nome: string;
  cpf: string;
  sn_ativo: boolean;
}

export default function ListaProfissionais() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selecionado, setSelecionado] = useState<Profissional | null>(null);
  const [resetando, setResetando] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const navigate = useNavigate();

  const carregarTabela = async () => {
    setLoading(true);
    setErro('');
    try {
      const response = await api.get('/profissionais/municipio');
      setProfissionais(response.data);
    } catch (error) {
      setErro('Falha ao carregar a Mesa de Controle dos Profissionais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTabela();
  }, []);

  const handleToggleStatus = async (p: Profissional) => {
    const acao = p.sn_ativo ? 'inativar' : 'ativar';
    if (!window.confirm(`Deseja ${acao} o profissional ${p.nome}?`)) return;
    
    try {
      await api.patch(`/profissionais/${p.id_profissional}/status`, { sn_ativo: !p.sn_ativo });
      carregarTabela();
    } catch (err) {
      alert('Erro ao alterar status do profissional.');
    }
  };

  const handleResetSenha = async () => {
    if (!selecionado) return;
    setResetando(true);
    setFeedback(null);
    try {
      await api.post(`/profissionais/${selecionado.id_profissional}/reset-senha`);
      setFeedback({ type: 'success', msg: `Senha de ${selecionado.nome} resetada para o CPF (${selecionado.cpf}).` });
      setTimeout(() => {
        setModalOpen(false);
        setSelecionado(null);
        setFeedback(null);
      }, 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.response?.data?.detail || 'Erro ao resetar a senha.' });
    } finally {
      setResetando(false);
    }
  };

  const profissionaisFiltrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || p.cpf.includes(busca.replace(/\D/g, ''))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      
      <PremiumHeader 
        icon={Users}
        title="Meus Profissionais"
        subtitle="Mesa de controle de acessos e médicos geridos pelo Município."
        action={
          <button
            onClick={() => navigate('/admin/profissionais/novo')}
            className="bg-primary hover:bg-secondary text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <UserCog size={18} /> Cadastrar Novo
          </button>
        }
      />

      {erro && (
        <div className="bg-red-50 text-red-600 rounded-2xl p-5 border border-red-100 font-bold flex items-center gap-3">
          <AlertTriangle size={20} />
          {erro}
        </div>
      )}

      {/* Busca */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="relative group">
          <input
            type="text"
            placeholder="Pesquisar por Nome ou CPF..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Search className="absolute left-4 top-4 text-slate-400 group-focus-within:text-primary" size={24} />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <LoadingSpinner label="A carregar a Matriz do Município..." className="py-20" />
        ) : profissionaisFiltrados.length === 0 ? (
          <div className="p-20 text-center text-slate-400 font-semibold">
            Nenhum profissional encontrado nesta malha de pesquisa.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500 font-black">
                  <th className="p-6">Nome do Profissional</th>
                  <th className="p-6">Documento (CPF)</th>
                  <th className="p-6">Situação</th>
                  <th className="p-6 text-right">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {profissionaisFiltrados.map((p) => (
                  <tr key={p.id_profissional} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6 font-bold text-slate-800">{p.nome}</td>
                    <td className="p-6 font-mono font-bold text-slate-500 tracking-wider">
                      {formatarCPF(p.cpf)}
                    </td>
                    <td className="p-6">
                      <StatusBadge 
                        label={p.sn_ativo ? "Ativo" : "Inativo"} 
                        type={p.sn_ativo ? "success" : "danger"} 
                      />
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`text-xs font-bold transition-colors ${p.sn_ativo ? 'text-red-500 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-800'}`}
                        >
                          {p.sn_ativo ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => navigate(`/admin/profissionais/editar/${p.id_profissional}`)}
                          className="text-xs font-bold text-primary hover:text-secondary"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => { setSelecionado(p); setModalOpen(true); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                          <KeyRound size={13} /> Resetar Senha
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Resetar Senha"
        subtitle="O cidadão será forçado a trocar ao logar no app."
        icon={KeyRound}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} disabled={resetando} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
            <button onClick={handleResetSenha} disabled={resetando || !!feedback} className="px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
              {resetando ? <Activity className="animate-spin" size={16} /> : <KeyRound size={16} />}
              Confirmar Reset
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-sm text-amber-800 font-semibold leading-relaxed">
              ⚠️ A senha de <span className="text-amber-950 font-black">{selecionado?.nome}</span> será alterada para o seu CPF: <span className="font-mono bg-amber-200/50 px-1 rounded">{selecionado?.cpf}</span>
            </p>
          </div>
          {feedback && (
            <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              {feedback.msg}
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}
