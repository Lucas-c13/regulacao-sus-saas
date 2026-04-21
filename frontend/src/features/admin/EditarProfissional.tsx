import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import {
  UserCog,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Stethoscope,
  ClipboardList,
  Shield,
  Activity
} from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

interface UBS { id_ubs: string; nome_ubs: string; }

export default function EditarProfissional() {
  const { id } = useParams<{ id: string }>(); // ID vindo da URL
  const navigate = useNavigate();
  // const { ubsAtiva } = useAuth(); // Não utilizado neste componente, o id da UBS vem do servidor

  const [ubsList, setUbsList] = useState<UBS[]>([]);
  const [idUbs, setIdUbs] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [conselho, setConselho] = useState('');

  // Estados de carga e feedback
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Permissões
  const [perfis, setPerfis] = useState({
    medico: false,
    recepcao: false,
    gestor: false
  });

  const formatarCPF = (valor: string) => {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    return nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  useEffect(() => {
    const carregarDadosBase = async () => {
      try {
        // Carrega UBS
        const resUbs = await api.get('/ubs/');
        const listaUbs = resUbs.data;
        if (Array.isArray(listaUbs)) {
          setUbsList(listaUbs);
        }

        // Carrega os dados atuais do Profissional
        const resProf = await api.get(`/profissionais/${id}`);
        const p = resProf.data;

        setNome(p.nome || '');
        setCpf(formatarCPF(p.cpf || ''));
        setConselho(p.conselho || '');
        setIdUbs(p.id_ubs || (listaUbs.length > 0 ? listaUbs[0].id_ubs : ''));

        // Configura permissões pelo JSONB recebido do banco
        if (p.permissoes) {
            setPerfis({
                medico: p.permissoes.medico === true || false,
                recepcao: p.permissoes.recepcao === true || false,
                gestor: p.permissoes.is_gestor_local === true || false
            });
        }
      } catch (e: any) {
        setErro(e.response?.data?.detail || 'Erro ao carregar dados do profissional.');
      } finally {
        setLoadingInitial(false);
      }
    };
    if (id) {
        carregarDadosBase();
    }
  }, [id]);

  const handleAtualizar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    // Garante que ao menos um perfil foi selecionado
    if (!perfis.medico && !perfis.recepcao && !perfis.gestor) {
      return setErro('Selecione pelo menos um perfil de acesso.');
    }

    setLoadingSubmit(true);
    try {
      // payload seguindo ProfissionalUpdate
      await api.put(`/profissionais/${id}`, {
        nome,
        conselho: conselho || undefined,
        // Traduz o state local para o dict esperado no banco
        permissoes: {
             medico: perfis.medico,
             recepcao: perfis.recepcao,
             is_gestor_local: perfis.gestor
        }
      });

      setSucesso(`Profissional "${nome}" atualizado com sucesso!`);
      setTimeout(() => navigate('/admin/profissionais'), 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao atualizar profissional.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loadingInitial) {
      return (
          <div className="flex justify-center items-center h-64 text-slate-500 font-medium space-x-3">
              <Activity className="animate-spin text-primary" size={24} />
              <span>A buscar dados do profissional...</span>
          </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
           <div className="p-4 bg-primary/10 rounded-xl text-primary">
             <UserCog size={32} />
           </div>
           <div>
             <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Editar Profissional</h2>
             <p className="text-slate-500 font-medium">Ajuste os dados e permissões do utilizador.</p>
           </div>
        </div>
        <button 
           onClick={() => navigate('/admin/profissionais')}
           className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2 hover:bg-slate-50 rounded-lg transition-colors"
        >
           ← Regressar
        </button>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        {sucesso && (
          <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl flex items-center space-x-3">
            <ShieldCheck className="text-emerald-500 flex-shrink-0" size={22} />
            <span className="font-semibold">{sucesso}</span>
          </div>
        )}

        {erro && (
          <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3">
            <ShieldAlert className="text-red-500 flex-shrink-0" size={22} />
            <span className="font-semibold text-sm">{erro}</span>
          </div>
        )}

        <form onSubmit={handleAtualizar} className="space-y-8">

          {/* SEÇÃO 1: DADOS BÁSICOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">UBS Vinculada</label>
              <div className="relative">
                <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={idUbs}
                  disabled // Desabilitado conforme regra de que Gestor Local não transfere
                  className="w-full pl-11 pr-4 py-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl outline-none font-semibold appearance-none cursor-not-allowed">
                  <option value="">{idUbs ? 'UBS Definida' : 'A Carregar UBS...'}</option>
                  {ubsList.map(ubs => (
                    <option key={ubs.id_ubs} value={ubs.id_ubs}>{ubs.nome_ubs || (ubs as any).nome}</option>
                  ))}
                </select>
                <div className="text-xs text-amber-600 mt-1 font-medium px-1">A transferência de UBS requer acionamento do Administrador do Município.</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome Completo</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold" placeholder="Nome do profissional" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">CPF (Login)</label>
              <input type="text" value={cpf} disabled className="w-full px-4 py-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl outline-none font-semibold font-mono cursor-not-allowed" title="O CPF é imutável via edição básica devido a chave do usuário" />
            </div>
          </div>

          {/* SEÇÃO 2: PERFIS DE ACESSO */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Shield size={16} className="text-primary" />
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Perfis e Permissões</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-slate-50 ${perfis.medico ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                <input type="checkbox" className="hidden" checked={perfis.medico} onChange={() => setPerfis({ ...perfis, medico: !perfis.medico })} />
                <Stethoscope size={24} className={perfis.medico ? 'text-primary' : 'text-slate-400'} />
                <span className={`mt-2 font-bold text-sm ${perfis.medico ? 'text-primary' : 'text-slate-600'}`}>Médico</span>
              </label>

              <label className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-slate-50 ${perfis.recepcao ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                <input type="checkbox" className="hidden" checked={perfis.recepcao} onChange={() => setPerfis({ ...perfis, recepcao: !perfis.recepcao })} />
                <ClipboardList size={24} className={perfis.recepcao ? 'text-primary' : 'text-slate-400'} />
                <span className={`mt-2 font-bold text-sm ${perfis.recepcao ? 'text-primary' : 'text-slate-600'}`}>Recepção</span>
              </label>

              <label className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-slate-50 ${perfis.gestor ? 'border-amber-500 bg-amber-50' : 'border-slate-100'}`}>
                <input type="checkbox" className="hidden" checked={perfis.gestor} onChange={() => setPerfis({ ...perfis, gestor: !perfis.gestor })} />
                <ShieldAlert size={24} className={perfis.gestor ? 'text-amber-600' : 'text-slate-400'} />
                <span className={`mt-2 font-bold text-sm ${perfis.gestor ? 'text-amber-600' : 'text-slate-600'}`}>Gestor Local</span>
              </label>
            </div>
          </div>

          {/* SEÇÃO 3: CLASSE */}
          <div className="grid grid-cols-1 gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-2 max-w-sm">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Registro de Classe (CRM/COREN)</label>
              <input type="text" value={conselho} onChange={e => setConselho(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold" placeholder="Ex: CRM-SP 12345" />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={loadingSubmit}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-10 rounded-xl shadow-lg flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50">
              {loadingSubmit ? (
                  <>
                    <Activity className="animate-spin" size={18} />
                    <span>A Salvar Edições...</span>
                  </>
             ) : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
