import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import {
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Stethoscope,
  ClipboardList,
  Shield
} from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

interface UBS { id_ubs: string; nome_ubs: string; }

export default function CadastroProfissional() {
  const { ubsAtiva } = useAuth();

  const [ubsList, setUbsList] = useState<UBS[]>([]);
  const [idUbs, setIdUbs] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [conselho, setConselho] = useState('');
  const [senha, setSenha] = useState('');

  // --- NOVO ESTADO DE PERFIS ---
  const [perfis, setPerfis] = useState({
    medico: false,
    recepcao: true, // Inicia como recepção por padrão
    gestor: false
  });

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const formatarCPF = (valor: string) => {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    return nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  useEffect(() => {
    const carregarUbs = async () => {
      try {
        const res = await api.get('/ubs/');
        const lista = res.data;
        if (Array.isArray(lista)) {
          setUbsList(lista);
          if (ubsAtiva) setIdUbs(ubsAtiva);
          else if (lista.length > 0) setIdUbs(lista[0].id_ubs);
        }
      } catch (e) { console.error('Erro ao carregar UBSs', e); }
    };
    carregarUbs();
  }, [ubsAtiva]);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    const cpfLimpo = cpf.replace(/\D/g, '');

    // Validações básicas
    if (cpfLimpo.length !== 11) return setErro('CPF inválido.');
    if (senha.length < 8) return setErro('Senha muito curta.');
    if (!idUbs) return setErro('Selecione a UBS.');

    // Garante que ao menos um perfil foi selecionado
    if (!perfis.medico && !perfis.recepcao && !perfis.gestor) {
      return setErro('Selecione pelo menos um perfil de acesso.');
    }

    setLoading(true);
    try {
      // Enviamos agora a lista de perfis para o backend tratar
      await api.post('/profissionais/', {
        nome,
        cpf: cpfLimpo,
        senha,
        id_ubs: idUbs,
        registro_conselho: conselho || undefined,
        perfis: Object.keys(perfis).filter(key => perfis[key as keyof typeof perfis])
      });

      setSucesso(`Profissional "${nome}" cadastrado com sucesso!`);
      // Limpa campos
      setNome(''); setCpf(''); setConselho(''); setSenha('');
      setPerfis({ medico: false, recepcao: true, gestor: false });
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao cadastrar profissional.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary">
          <UserPlus size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Novo Profissional</h2>
          <p className="text-slate-500 font-medium">Configure os dados e níveis de acesso na rede.</p>
        </div>
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

        <form onSubmit={handleCadastrar} className="space-y-8">

          {/* SEÇÃO 1: DADOS BÁSICOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">UBS Principal</label>
              <div className="relative">
                <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={idUbs}
                  onChange={e => setIdUbs(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold appearance-none">
                  <option value="">Selecione a UBS...</option>
                  {ubsList.map(ubs => (
                    <option key={ubs.id_ubs} value={ubs.id_ubs}>{ubs.nome_ubs || (ubs as any).nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome Completo</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required className="input-standard" placeholder="Nome do profissional" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">CPF (Login)</label>
              <input type="text" value={cpf} onChange={e => setCpf(formatarCPF(e.target.value))} required maxLength={14} className="input-standard font-mono" placeholder="000.000.000-00" />
            </div>
          </div>

          {/* SEÇÃO 2: PERFIS DE ACESSO (O PULO DO GATO) */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Shield size={16} className="text-primary" />
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Perfis e Permissões</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card Médico */}
              <label className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-slate-50 ${perfis.medico ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                <input type="checkbox" className="hidden" checked={perfis.medico} onChange={() => setPerfis({ ...perfis, medico: !perfis.medico })} />
                <Stethoscope size={24} className={perfis.medico ? 'text-primary' : 'text-slate-400'} />
                <span className={`mt-2 font-bold text-sm ${perfis.medico ? 'text-primary' : 'text-slate-600'}`}>Médico</span>
                <span className="text-[10px] text-slate-400 leading-tight mt-1">Acesso a prontuário e escalas de atendimento.</span>
              </label>

              {/* Card Recepção */}
              <label className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-slate-50 ${perfis.recepcao ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                <input type="checkbox" className="hidden" checked={perfis.recepcao} onChange={() => setPerfis({ ...perfis, recepcao: !perfis.recepcao })} />
                <ClipboardList size={24} className={perfis.recepcao ? 'text-primary' : 'text-slate-400'} />
                <span className={`mt-2 font-bold text-sm ${perfis.recepcao ? 'text-primary' : 'text-slate-600'}`}>Recepção</span>
                <span className="text-[10px] text-slate-400 leading-tight mt-1">Gestão de fila, presenças e agendamentos.</span>
              </label>

              {/* Card Gestor */}
              <label className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-slate-50 ${perfis.gestor ? 'border-amber-500 bg-amber-50' : 'border-slate-100'}`}>
                <input type="checkbox" className="hidden" checked={perfis.gestor} onChange={() => setPerfis({ ...perfis, gestor: !perfis.gestor })} />
                <ShieldAlert size={24} className={perfis.gestor ? 'text-amber-600' : 'text-slate-400'} />
                <span className={`mt-2 font-bold text-sm ${perfis.gestor ? 'text-amber-600' : 'text-slate-600'}`}>Gestor Local</span>
                <span className="text-[10px] text-slate-400 leading-tight mt-1">Configurações da UBS, auditoria e relatórios.</span>
              </label>
            </div>
          </div>

          {/* SEÇÃO 3: SEGURANÇA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Registro de Classe (CRM/COREN)</label>
              <input type="text" value={conselho} onChange={e => setConselho(e.target.value)} className="input-standard" placeholder="Ex: CRM-SP 12345" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-600 uppercase tracking-wide">Senha Temporária</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={8} className="w-full px-4 py-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 font-semibold" placeholder="Mínimo 8 caracteres" />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end items-center space-x-4">
            <span className="text-xs text-slate-400 italic font-medium">O usuário será forçado a trocar a senha no 1º acesso.</span>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-10 rounded-xl shadow-lg flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50">
              {loading ? 'Processando...' : 'Finalizar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}