import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { Users, Search, Activity, UserCog, KeyRound, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Profissional {
  id_profissional: string;
  nome: string;
  cpf: string;
  sn_ativo: boolean;
}

interface ModalConfirmacao {
  aberto: boolean;
  profissional: Profissional | null;
}

export default function ListaProfissionais() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<ModalConfirmacao>({ aberto: false, profissional: null });
  const [resetando, setResetando] = useState(false);
  const [resetSucesso, setResetSucesso] = useState<string | null>(null);
  const [resetErro, setResetErro] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const carregarTabela = async () => {
      try {
        const response = await api.get('/profissionais/municipio');
        setProfissionais(response.data);
      } catch (error) {
        setErro('Falha ao carregar a Mesa de Controle dos Profissionais.');
      } finally {
        setLoading(false);
      }
    };
    carregarTabela();
  }, []);

  const profissionaisFiltrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) || p.cpf.includes(busca)
  );

  const abrirModal = (p: Profissional) => {
    setResetSucesso(null);
    setResetErro(null);
    setModal({ aberto: true, profissional: p });
  };

  const fecharModal = () => {
    if (!resetando) setModal({ aberto: false, profissional: null });
  };

  const confirmarReset = async () => {
    if (!modal.profissional) return;
    setResetando(true);
    setResetErro(null);
    try {
      await api.post(`/profissionais/${modal.profissional.id_profissional}/reset-senha`);
      // Lemos o CPF e formatamos se possivel para avisar, caso contrátio usamos fallback visual
      const cpfFormatado = modal.profissional.cpf || '123456';
      setResetSucesso(`Senha de ${modal.profissional.nome} resetada para o CPF (${cpfFormatado}).`);
      setTimeout(() => {
        setModal({ aberto: false, profissional: null });
        setResetSucesso(null);
      }, 3500);
    } catch (err: any) {
      setResetErro(err.response?.data?.detail || 'Erro ao resetar a senha.');
    } finally {
      setResetando(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Modal de Confirmação */}
      {modal.aberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Resetar Senha</h3>
                  <p className="text-sm text-slate-500 font-medium">Ação de segurança irreversível</p>
                </div>
              </div>
              <button onClick={fecharModal} disabled={resetando} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-800 font-semibold">
                ⚠️ A senha de <span className="font-black">{modal.profissional?.nome}</span> será alterada para o seu{' '}
                <code className="bg-amber-200 px-1.5 py-0.5 rounded font-mono text-xs">CPF</code> (apenas números).
              </p>
              <p className="text-xs text-amber-700 mt-2 font-medium">
                O profissional será obrigado a trocar a senha no próximo login (protocolo Zero Trust).
              </p>
            </div>

            {resetSucesso && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 mb-4 text-sm font-semibold">
                <CheckCircle size={18} className="shrink-0" />
                <span>{resetSucesso}</span>
              </div>
            )}

            {resetErro && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm font-semibold">
                <AlertTriangle size={18} className="shrink-0" />
                <span>{resetErro}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={fecharModal}
                disabled={resetando}
                className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarReset}
                disabled={resetando || !!resetSucesso}
                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resetando ? (
                  <Activity size={16} className="animate-spin" />
                ) : (
                  <KeyRound size={16} />
                )}
                {resetando ? 'Resetando...' : 'Confirmar Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Premium */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-primary/10 rounded-xl text-primary">
            <Users size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Meus Profissionais</h2>
            <p className="text-slate-500 font-medium">Mesa de controle de acessos e médicos geridos pelo Município.</p>
          </div>
        </div>
        <div>
          <button
            onClick={() => navigate('/admin/profissionais/novo')}
            className="bg-primary hover:bg-secondary text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <UserCog size={18} /> Cadastrar Novo
          </button>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">

        {/* Barra de Pesquisa */}
        <div className="mb-8 relative">
          <input
            type="text"
            placeholder="Pesquisar por Nome ou CPF..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Search className="absolute left-4 top-4 text-slate-400" size={24} />
        </div>

        {erro && (
          <div className="mb-6 bg-red-50 text-red-600 rounded-lg p-4 font-semibold">{erro}</div>
        )}

        {/* Tabela */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <th className="p-5">Nome do Profissional</th>
                <th className="p-5">C.P.F.</th>
                <th className="p-5">Estado</th>
                <th className="p-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-medium">
                    <Activity className="animate-spin mx-auto mb-2 text-primary" />
                    A carregar a Matriz do Município...
                  </td>
                </tr>
              ) : profissionaisFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-semibold">
                    Nenhum profissional encontrado nesta malha de pesquisa.
                  </td>
                </tr>
              ) : (
                profissionaisFiltrados.map((p) => (
                  <tr key={p.id_profissional} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 font-bold text-slate-800">{p.nome}</td>
                    <td className="p-5 font-medium text-slate-500 tracking-wider">
                      {p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                    </td>
                    <td className="p-5">
                      {p.sn_ativo ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          🟢 Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                          🔴 Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {p.sn_ativo ? (
                          <button
                            onClick={async () => {
                              if(window.confirm(`Deseja inativar o profissional ${p.nome}?`)){
                                await api.patch(`/profissionais/${p.id_profissional}/status`, { sn_ativo: false });
                                setProfissionais(profissionais.map(prof => prof.id_profissional === p.id_profissional ? { ...prof, sn_ativo: false } : prof));
                              }
                            }}
                            className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline transition-colors mr-2"
                          >
                            Inativar
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              await api.patch(`/profissionais/${p.id_profissional}/status`, { sn_ativo: true });
                              setProfissionais(profissionais.map(prof => prof.id_profissional === p.id_profissional ? { ...prof, sn_ativo: true } : prof));
                            }}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-800 hover:underline transition-colors mr-2"
                          >
                            Ativar
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/profissionais/editar/${p.id_profissional}`)}
                          className="text-sm font-bold text-primary hover:text-secondary hover:underline transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          id={`btn-reset-${p.id_profissional}`}
                          onClick={() => abrirModal(p)}
                          title="Resetar senha para padrão (CPF)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                          <KeyRound size={13} /> Resetar Senha
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
