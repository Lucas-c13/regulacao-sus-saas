import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { Stethoscope, Plus, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

interface Especialidade {
  id_especialidade: string;
  nome: string;
  is_livre_demanda: boolean;
}

export default function GestaoEspecialidades() {
  const { userRole } = useAuth();
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [nomeNova, setNomeNova] = useState('');
  const [livredemanda, setLivreDemanda] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingLista, setLoadingLista] = useState(true);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');

  const carregarEspecialidades = async () => {
    setLoadingLista(true);
    try {
      const res = await api.get('/especialidades/');
      if (Array.isArray(res.data)) setEspecialidades(res.data);
    } catch (e) { console.error(e); }
    finally { setLoadingLista(false); }
  };

  useEffect(() => { carregarEspecialidades(); }, []);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    if (!nomeNova.trim()) return;

    setLoading(true);
    try {
      await api.post('/especialidades/', {
        nome: nomeNova.trim(),
        is_livre_demanda: livredemanda,
      });
      setSucesso(`Especialidade "${nomeNova}" criada com sucesso!`);
      setNomeNova('');
      carregarEspecialidades();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao criar especialidade.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id: string, nome: string) => {
    if (!confirm(`Remover a especialidade "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setErro('');
    try {
      await api.delete(`/especialidades/${id}`);
      setSucesso(`Especialidade "${nome}" removida.`);
      carregarEspecialidades();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao remover. Verifique se há escalas vinculadas.');
    }
  };

  if (userRole !== 'admin_master') {
    return <div className="p-8 text-red-500 font-bold">Acesso restrito ao administrador master.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary">
          <Stethoscope size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Especialidades</h2>
          <p className="text-slate-500 font-medium">Cadastre as especialidades médicas disponíveis na rede de saúde.</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Nova Especialidade</h3>

        {sucesso && (
          <div className="mb-4 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl flex items-center space-x-3">
            <CheckCircle2 size={20} className="text-emerald-500" />
            <span className="font-semibold">{sucesso}</span>
          </div>
        )}
        {erro && (
          <div className="mb-4 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3">
            <ShieldAlert size={20} className="text-red-500" />
            <span className="font-semibold text-sm">{erro}</span>
          </div>
        )}

        <form onSubmit={handleCriar} className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={nomeNova}
              onChange={e => setNomeNova(e.target.value)}
              required
              placeholder="Ex: Cardiologia, Pediatria, Clínica Geral..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
            />
            <button
              type="submit"
              disabled={loading || !nomeNova.trim()}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-6 rounded-xl flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
            >
              <Plus size={20} />
              <span>{loading ? 'Criando...' : 'Adicionar'}</span>
            </button>
          </div>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={livredemanda}
              onChange={e => setLivreDemanda(e.target.checked)}
              className="w-5 h-5 text-primary rounded"
            />
            <span className="text-sm font-semibold text-slate-700">Disponível para livre demanda (sem encaminhamento)</span>
          </label>
        </form>
      </div>

      {/* Lista */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Especialidades Cadastradas</h3>

        {loadingLista ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
          </div>
        ) : especialidades.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Stethoscope size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma especialidade cadastrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {especialidades.map(esp => (
              <div key={esp.id_especialidade} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-primary/30 transition-colors">
                <div className="flex items-center space-x-3">
                  <Stethoscope size={18} className="text-primary" />
                  <div>
                    <span className="font-bold text-slate-800">{esp.nome}</span>
                    {esp.is_livre_demanda && (
                      <span className="ml-2 text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Livre Demanda</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemover(esp.id_especialidade, esp.nome)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remover especialidade"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
