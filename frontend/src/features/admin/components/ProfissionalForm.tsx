import { useState, useEffect } from 'react';
import {
  UserPlus,
  UserCog,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Stethoscope,
  ClipboardList,
  Shield,
  Activity,
  Award
} from 'lucide-react';
import { api } from '../../../core/api';
import { formatarCPF } from '../../../utils/formatters';

// Shared Components
import { PremiumHeader } from '../../../shared/components/PremiumHeader';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner';

interface PerfisContract {
  medico: boolean;
  recepcao: boolean;
  is_gestor_local: boolean;
}

interface Especialidade {
  id_especialidade: string;
  nome: string;
}

interface ProfissionalFormData {
  idUbs: string;
  nome: string;
  cpf: string;
  conselho: string;
  id_especialidade?: string;
  senha?: string;
  permissoes: PerfisContract;
}

interface ProfissionalFormProps {
  ubsList: Array<{ id_ubs: string; nome_ubs?: string; nome?: string }>;
  dadosIniciais?: Partial<ProfissionalFormData>;
  isEdicao?: boolean;
  loading: boolean;
  erro: string;
  sucesso: string;
  onSubmit: (dados: ProfissionalFormData) => void;
  onCancel?: () => void;
}

export default function ProfissionalForm({
  ubsList,
  dadosIniciais,
  isEdicao = false,
  loading,
  erro,
  sucesso,
  onSubmit,
  onCancel
}: ProfissionalFormProps) {
  
  const [idUbs, setIdUbs] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [conselho, setConselho] = useState('');
  const [idEspecialidade, setIdEspecialidade] = useState('');
  const [senha, setSenha] = useState('');
  
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [loadingEsp, setLoadingEsp] = useState(false);

  const [perfis, setPerfis] = useState({
    medico: false,
    recepcao: false,
    gestor: false
  });

  useEffect(() => {
    const carregarEspecialidades = async () => {
      setLoadingEsp(true);
      try {
        const res = await api.get('/especialidades/');
        setEspecialidades(res.data);
      } catch (e) {
        console.error('Falha ao carregar especialidades');
      } finally {
        setLoadingEsp(false);
      }
    };
    carregarEspecialidades();
  }, []);

  useEffect(() => {
    if (dadosIniciais) {
      setIdUbs(dadosIniciais.idUbs || '');
      setNome(dadosIniciais.nome || '');
      setCpf(formatarCPF(dadosIniciais.cpf || ''));
      setConselho(dadosIniciais.conselho || '');
      setIdEspecialidade(dadosIniciais.id_especialidade || '');
      if (dadosIniciais.permissoes) {
        setPerfis({
          medico: dadosIniciais.permissoes.medico || false,
          recepcao: dadosIniciais.permissoes.recepcao || false,
          gestor: dadosIniciais.permissoes.is_gestor_local || false
        });
      }
    } else if (!isEdicao && ubsList.length > 0 && !idUbs) {
      setIdUbs(ubsList[0].id_ubs);
      setPerfis(prev => ({ ...prev, recepcao: true }));
    }
  }, [dadosIniciais, ubsList, isEdicao]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      idUbs,
      nome,
      cpf: cpf.replace(/\D/g, ''),
      conselho,
      id_especialidade: idEspecialidade || undefined,
      senha: isEdicao ? undefined : senha,
      permissoes: {
        medico: perfis.medico,
        recepcao: perfis.recepcao,
        is_gestor_local: perfis.gestor
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10 animate-in fade-in duration-500">
      
      <PremiumHeader 
        icon={isEdicao ? UserCog : UserPlus}
        title={isEdicao ? 'Editar Profissional' : 'Novo Profissional'}
        subtitle="Configure os dados e níveis de acesso na rede."
        action={
          isEdicao && onCancel && (
            <button 
              type="button"
              onClick={onCancel}
              className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors"
            >
              ← Regressar
            </button>
          )
        }
      />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        {sucesso && (
          <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl flex items-center space-x-3">
            <ShieldCheck className="text-emerald-500 flex-shrink-0" size={22} />
            <span className="font-bold">{sucesso}</span>
          </div>
        )}

        {erro && (
          <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3">
            <ShieldAlert className="text-red-500 flex-shrink-0" size={22} />
            <span className="font-bold text-sm">{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SEÇÃO 1: VÍNCULO UBS */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Unidade de Saúde de Referência
            </label>
            <div className="relative">
              <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={idUbs}
                onChange={e => setIdUbs(e.target.value)}
                disabled={isEdicao}
                required
                className={`w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 font-bold appearance-none transition-all ${isEdicao ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-70' : 'hover:border-primary/50'}`}>
                <option value="">Selecione a unidade...</option>
                {ubsList.map(ubs => (
                  <option key={ubs.id_ubs} value={ubs.id_ubs}>{ubs.nome_ubs || ubs.nome}</option>
                ))}
              </select>
              {isEdicao && <div className="text-[10px] text-amber-600 mt-1.5 font-bold uppercase tracking-wide px-1 italic">Transferência de unidade requer permissão do Administrador Central.</div>}
            </div>
          </div>

          {/* SEÇÃO 2: DADOS IDENTITÁRIOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all hover:border-primary/50" 
                placeholder="Nome do profissional" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">C.P.F. (Login)</label>
              <input 
                type="text" 
                value={cpf} 
                onChange={e => !isEdicao && setCpf(formatarCPF(e.target.value))} 
                required 
                maxLength={14} 
                className={`w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 font-black font-mono transition-all ${isEdicao ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-70' : 'hover:border-primary/50'}`} 
                placeholder="000.000.000-00" 
                disabled={isEdicao}
              />
            </div>
          </div>

          {/* SEÇÃO 3: PERFIS E PERMISSÕES */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Shield size={16} className="text-primary" />
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Matriz de Perfis e Acesso</label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className={`relative flex flex-col p-5 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${perfis.medico ? 'border-primary bg-primary/5' : 'border-slate-100 bg-slate-50'}`}>
                <input type="checkbox" className="hidden" checked={perfis.medico} onChange={() => setPerfis({ ...perfis, medico: !perfis.medico })} />
                <Stethoscope size={28} className={perfis.medico ? 'text-primary' : 'text-slate-400'} />
                <span className={`mt-3 font-black text-sm ${perfis.medico ? 'text-primary' : 'text-slate-600'}`}>Clínico / Médico</span>
                <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase leading-tight">Escalas e Prontuários</span>
              </label>

              <label className={`relative flex flex-col p-5 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${perfis.recepcao ? 'border-primary bg-primary/5' : 'border-slate-100 bg-slate-50'}`}>
                <input type="checkbox" className="hidden" checked={perfis.recepcao} onChange={() => setPerfis({ ...perfis, recepcao: !perfis.recepcao })} />
                <ClipboardList size={28} className={perfis.recepcao ? 'text-primary' : 'text-slate-400'} />
                <span className={`mt-3 font-black text-sm ${perfis.recepcao ? 'text-primary' : 'text-slate-600'}`}>Recepção / Apoio</span>
                <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase leading-tight">Fila e Agendamentos</span>
              </label>

              <label className={`relative flex flex-col p-5 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-md ${perfis.gestor ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 bg-slate-50'}`}>
                <input type="checkbox" className="hidden" checked={perfis.gestor} onChange={() => setPerfis({ ...perfis, gestor: !perfis.gestor })} />
                <ShieldAlert size={28} className={perfis.gestor ? 'text-amber-600' : 'text-slate-400'} />
                <span className={`mt-3 font-black text-sm ${perfis.gestor ? 'text-amber-600' : 'text-slate-600'}`}>Gestor Local</span>
                <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase leading-tight">Gestão da Unidade</span>
              </label>
            </div>
          </div>

          {/* SEÇÃO 4: ESPECIALIDADE E CLASSE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
             <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Award size={14} className="text-secondary" /> Especialidade Médica
              </label>
              <select
                value={idEspecialidade}
                onChange={e => setIdEspecialidade(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 font-bold appearance-none transition-all hover:border-primary/50">
                <option value="">Selecione a formação...</option>
                {especialidades.map(esp => (
                  <option key={esp.id_especialidade} value={esp.id_especialidade}>{esp.nome}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registo de Classe (CRM/COREN)</label>
              <input type="text" value={conselho} onChange={e => setConselho(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all hover:border-primary/50" placeholder="Ex: CRM-SP 12345" />
            </div>
          </div>

          {/* SEÇÃO 5: SEGURANÇA (APENAS CADASTRO) */}
          {!isEdicao && (
            <div className="pt-6 border-t border-slate-100">
               <div className="space-y-2 max-w-sm">
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">Senha de Acesso Provisória</label>
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required minLength={8} className="w-full px-4 py-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl outline-none focus:ring-4 focus:ring-amber-500/20 font-bold transition-all" placeholder="Mínimo 8 caracteres" />
                <p className="text-[10px] text-amber-500 font-bold italic ml-1">O profissional será obrigado a trocar no primeiro acesso.</p>
              </div>
            </div>
          )}

          <div className="pt-8 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white font-black py-4 px-12 rounded-2xl shadow-xl shadow-primary/20 flex items-center space-x-3 transition-all active:scale-95 disabled:opacity-50">
              {loading ? (
                  <LoadingSpinner label="A processar..." size={18} className="p-0 text-white" />
             ) : (
                <>
                   {isEdicao ? <UserCog size={20} /> : <UserPlus size={20} />}
                   <span>{isEdicao ? 'Confirmar Alterações' : 'Finalizar e Ativar Profissional'}</span>
                </>
             )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
