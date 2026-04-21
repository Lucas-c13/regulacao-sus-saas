import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { HeartPulse, CheckCircle2, ShieldAlert, Search, User, UserX, AlertCircle, Loader2, X } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';
import { formatarCPF } from '../../utils/formatters';

type Modo = 'cadsus' | 'manual';

interface ResultadoCadastro {
  msg: string;
  id_paciente?: string;
  nome?: string;
  ja_existia?: boolean;
  is_validado_sus?: boolean;
  aviso?: string;
}

export default function CadastroPaciente() {
  const { ubsAtiva, userPayload } = useAuth();
  const [modo, setModo] = useState<Modo>('cadsus');

  // Estado CADSUS
  const [cpf, setCpf] = useState('');
  
  // Estado Manual
  const [nmPaciente, setNmPaciente] = useState('');
  const [nmMae, setNmMae] = useState('');
  const [cpfManual, setCpfManual] = useState('');
  const [cns, setCns] = useState('');
  const [dtNascimento, setDtNascimento] = useState('');
  const [sexo, setSexo] = useState('M');
  const [celular, setCelular] = useState('');

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<ResultadoCadastro | null>(null);
  
  // Modal Fallback
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [cpfTentativa, setCpfTentativa] = useState('');


  const cpfLimpo = cpf.replace(/\D/g, '');
  const cpfManualLimpo = cpfManual.replace(/\D/g, '');

  // Busca automática ao atingir 11 dígitos
  useEffect(() => {
    if (cpfLimpo.length === 11 && !loading) {
      handleCadastroCadsus();
    }
  }, [cpfLimpo]);

  // Modo CADSUS
  const handleCadastroCadsus = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErro('');
    setResultado(null);

    if (cpfLimpo.length !== 11) return;
    if (!userPayload?.tenant_id) { setErro('Sessão inválida. Faça login novamente.'); return; }

    setLoading(true);
    try {
      const res = await api.post(`/pacientes/validar-cadsus/${cpfLimpo}`, {
        id_municipio: userPayload.tenant_id,
        id_ubs_referencia: ubsAtiva || userPayload.tenant_id,
        cpf: cpfLimpo,
        celular: '',
        aceitou_lgpd: true, // Automático no Web
        dt_aceite_lgpd: new Date().toISOString(),
      });
      setResultado(res.data);
      setCpf('');
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      
      setCpfTentativa(cpf);
      if (status === 503 || status === 404 || detail?.toLowerCase().includes('não encontrado')) {
        setShowFallbackModal(true);
      } else {
        setErro(typeof detail === 'string' ? detail : 'Erro ao validar no CADSUS.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Modo Manual
  const handleCadastroManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setResultado(null);

    if (!cpfManualLimpo && !cns.trim()) { setErro('Informe pelo menos o CPF ou o CNS do paciente.'); return; }
    if (!userPayload?.tenant_id) { setErro('Sessão inválida. Faça login novamente.'); return; }

    setLoading(true);
    try {
      const res = await api.post('/pacientes/cadastro-manual', {
        id_municipio: userPayload.tenant_id,
        id_ubs_referencia: ubsAtiva || null,
        nr_cpf: cpfManualLimpo || null,
        nr_cns: cns.replace(/\D/g, '') || null,
        nm_paciente: nmPaciente,
        nm_mae: nmMae || null,
        dt_nascimento: dtNascimento,
        tp_sexo: sexo,
        celular: celular || null,
        aceitou_lgpd: true, // Automático no Web
      });
      setResultado(res.data);
      // Reset
      setNmPaciente(''); setNmMae(''); setCpfManual(''); setCns('');
      setDtNascimento(''); setCelular('');
      setModo('cadsus');
      setShowFallbackModal(false);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao cadastrar paciente manualmente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmarFallback = () => {
    setCpfManual(cpfTentativa);
    setModo('manual');
    setShowFallbackModal(false);
    setErro('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* Header Premium */}
      <div className="bg-gradient-to-br from-white to-slate-50 p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-white flex items-center justify-between">
        <div className="flex items-center space-x-5">
          <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner">
            <HeartPulse size={36} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admissão de Cidadão</h2>
            <p className="text-slate-500 font-medium">Fluxo inteligente integrado ao CADSUS Federal</p>
          </div>
        </div>
        <div className="hidden md:block">
           <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${modo === 'cadsus' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {modo === 'cadsus' ? 'Modo Automático' : 'Modo Manual'}
           </div>
        </div>
      </div>

      {/* Busca CADSUS Única (Lead Flow) */}
      {modo === 'cadsus' && (
        <div className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          
          <form onSubmit={handleCadastroCadsus} className="space-y-8 relative">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Identificação por CPF</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                  {loading ? <Loader2 size={24} className="animate-spin" /> : <User size={24} />}
                </div>
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(formatarCPF(e.target.value))}
                  autoFocus
                  required
                  maxLength={14}
                  className="w-full pl-16 pr-6 py-6 bg-slate-50 border-2 border-slate-100 text-slate-900 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all font-black text-2xl tracking-[0.2em] placeholder:text-slate-200"
                  placeholder="000.000.000-00"
                  disabled={loading}
                />
              </div>
              <div className="flex items-center space-x-2 text-primary/70 font-semibold text-sm px-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <span>A busca iniciará automaticamente após os 11 dígitos.</span>
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl flex items-start space-x-4">
              <div className="bg-blue-500 text-white p-2 rounded-lg">
                <Search size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">Consulta em tempo real</p>
                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                  Ao informar o CPF, validaremos os dados na base nacional do SUS (Nome e CNS).
                  Caso o sistema esteja indisponível, você poderá cadastrar manualmente.
                </p>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Resultado (Se houver) */}
      {resultado && (
        <div className={`p-6 rounded-3xl border-2 shadow-lg animate-in slide-in-from-top-4 duration-300 ${resultado.is_validado_sus === false ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-2xl ${resultado.is_validado_sus === false ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
               <CheckCircle2 size={28} />
            </div>
            <div>
              <p className="font-black text-xl text-slate-900 leading-tight">{resultado.nome || 'Cidadão registrado!'}</p>
              <p className="text-sm text-slate-600 font-medium">{resultado.msg}</p>
            </div>
          </div>
          {resultado.id_paciente && (
            <div className="mt-4 flex flex-wrap gap-2">
               <span className="px-3 py-1 bg-white/60 border border-slate-200 rounded-full text-xs font-mono text-slate-500">ID {resultado.id_paciente}</span>
               {resultado.is_validado_sus && <span className="px-3 py-1 bg-emerald-500/10 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase">Validado CADSUS</span>}
            </div>
          )}
        </div>
      )}

      {erro && !showFallbackModal && (
        <div className="bg-red-50 text-red-700 border-2 border-red-100 p-6 rounded-3xl flex items-start space-x-4 animate-in shake duration-300">
          <ShieldAlert className="text-red-500 mt-1" size={24} />
          <div>
            <p className="font-bold text-lg">Houve um imprevisto</p>
            <p className="text-sm font-medium opacity-80">{erro}</p>
          </div>
        </div>
      )}

      {/* Formulário Manual */}
      {modo === 'manual' && (
        <div className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
               <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                 <UserX size={24} />
               </div>
               <h3 className="text-xl font-black text-slate-800">Formulário Manual</h3>
            </div>
            <button onClick={() => setModo('cadsus')} className="text-slate-400 hover:text-slate-600 font-bold text-sm flex items-center gap-1">
               <Loader2 size={16} /> Voltar para busca
            </button>
          </div>

          <form onSubmit={handleCadastroManual} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                <input type="text" value={nmPaciente} onChange={e => setNmPaciente(e.target.value)} required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 text-slate-900 rounded-2xl outline-none focus:border-primary transition-all font-semibold"
                  placeholder="Nome do cidadão conforme RG/CNS" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome da Mãe</label>
                <input type="text" value={nmMae} onChange={e => setNmMae(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 text-slate-900 rounded-2xl outline-none focus:border-primary transition-all font-semibold"
                  placeholder="Nome materno" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Data de Nascimento</label>
                <input type="date" value={dtNascimento} onChange={e => setDtNascimento(e.target.value)} required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 text-slate-900 rounded-2xl outline-none focus:border-primary transition-all font-semibold" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">CPF</label>
                <input type="text" value={cpfManual} onChange={e => setCpfManual(formatarCPF(e.target.value))} maxLength={14}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 text-slate-900 rounded-2xl outline-none focus:border-primary transition-all font-bold tracking-widest"
                  placeholder="000.000.000-00" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-emerald-600 uppercase tracking-widest ml-1">Cartão SUS (CNS)</label>
                <input type="text" value={cns} onChange={e => setCns(e.target.value)} maxLength={18}
                  className="w-full px-5 py-4 bg-emerald-50/50 border-2 border-emerald-100 text-emerald-900 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold tracking-widest"
                  placeholder="700 0000 0000 0000" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Sexo Biológico</label>
                <select value={sexo} onChange={e => setSexo(e.target.value)} required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 text-slate-900 rounded-2xl outline-none focus:border-primary transition-all font-semibold">
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="I">Não Informado</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Celular</label>
                <input type="tel" value={celular} onChange={e => setCelular(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 text-slate-900 rounded-2xl outline-none focus:border-primary transition-all font-semibold"
                  placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={loading || (!cpfManualLimpo && !cns) || !nmPaciente || !dtNascimento}
                className="bg-slate-800 hover:bg-slate-900 text-white font-black py-4 px-10 rounded-2xl shadow-xl shadow-slate-300 disabled:opacity-50 transition-all active:scale-95 flex items-center space-x-2">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                <span>{loading ? 'Processando...' : 'Finalizar Registro'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Fallback Premium */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white max-w-lg w-full rounded-[2.5rem] shadow-2xl border border-white overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2">
                <AlertCircle size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900">Cidadão não encontrado</h3>
                <p className="text-slate-500 font-medium px-4">
                  Não localizamos dados para o CPF <span className="font-bold text-slate-800">{cpfTentativa}</span> no CADSUS. 
                  O sistema está instável ou o CPF é novo/inválido.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  onClick={() => setShowFallbackModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Tentar outro CPF
                </button>
                <button 
                  onClick={confirmarFallback}
                  className="flex-1 px-6 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:bg-secondary transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <UserX size={18} />
                  Cadastro Manual
                </button>
              </div>
            </div>
            <div className="bg-slate-50 p-6 flex justify-center border-t border-slate-100">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Procedimento de Contingência SUS</p>
            </div>
          </div>
        </div>
      )}

      {/* Botão flutuante de Manual (Apenas se já estiver no CADSUS) */}
      {modo === 'cadsus' && !loading && !resultado && (
        <div className="flex justify-center pt-8">
           <button onClick={() => setModo('manual')} className="text-slate-400 hover:text-slate-600 font-bold text-sm underline underline-offset-4 decoration-slate-200">
             Não tem CPF ou quer preencher manual? Clique aqui.
           </button>
        </div>
      )}

    </div>
  );
}
