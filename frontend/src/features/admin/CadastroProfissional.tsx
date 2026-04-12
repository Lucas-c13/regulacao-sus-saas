import { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { UserPlus, ShieldCheck, ShieldAlert, Building2, Stethoscope } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

interface UBS { id_ubs: string; nome_ubs: string; }

export default function CadastroProfissional() {
  const { userPayload, ubsAtiva } = useAuth();
  
  const [ubsList, setUbsList] = useState<UBS[]>([]);
  const [idUbs, setIdUbs] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [conselho, setConselho] = useState('');
  const [senha, setSenha] = useState('');
  const [isGestorLocal, setIsGestorLocal] = useState(false);
  
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

  // Carrega lista de UBSs
  useEffect(() => {
    const carregarUbs = async () => {
      try {
        const res = await api.get('/ubs/');
        const lista = res.data;
        if (Array.isArray(lista)) {
          setUbsList(lista);
          // Pré-seleciona a UBS ativa do header, se disponível
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
    
    if (cpfLimpo.length !== 11) {
      setErro('CPF inválido. Informe os 11 dígitos.');
      return;
    }
    if (senha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (!idUbs) {
      setErro('Selecione a UBS onde o profissional irá atuar.');
      return;
    }

    setLoading(true);
    try {
      // Usa rota gestor-local (funciona para admin_master)
      const res = await api.post('/profissionais/gestor-local', {
        nome,
        cpf: cpfLimpo,
        senha,
        id_ubs: idUbs,
        registro_conselho: conselho || undefined,
      });

      // Se marcado como gestor local, faz uma segunda chamada ou informa usuário
      setSucesso(
        isGestorLocal 
          ? `Profissional "${nome}" cadastrado como Gestor Local desta UBS!`
          : `Profissional "${nome}" cadastrado com sucesso!`
      );
      setNome(''); setCpf(''); setConselho(''); setSenha('');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErro(typeof detail === 'string' ? detail : 'Erro ao cadastrar profissional. Verifique os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary">
          <UserPlus size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Cadastro de Profissional</h2>
          <p className="text-slate-500 font-medium">Adicione médicos, enfermeiros e recepcionistas à rede de saúde.</p>
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

        <form onSubmit={handleCadastrar} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* UBS */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Unidade de Saúde (UBS)</label>
              <div className="relative">
                <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  value={idUbs} 
                  onChange={e => setIdUbs(e.target.value)} 
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold appearance-none">
                  <option value="">Selecione a UBS...</option>
                  {ubsList.map(ubs => (
                    <option key={ubs.id_ubs} value={ubs.id_ubs}>{ubs.nome_ubs || (ubs as any).nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome Completo</label>
              <input 
                type="text" 
                value={nome} 
                onChange={e => setNome(e.target.value)} 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
                placeholder="Ex: Dr. João da Silva" 
              />
            </div>

            {/* CPF */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">CPF (será o login)</label>
              <input 
                type="text" 
                value={cpf} 
                onChange={e => setCpf(formatarCPF(e.target.value))} 
                required 
                maxLength={14}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-bold tracking-widest"
                placeholder="000.000.000-00" 
              />
            </div>

            {/* Conselho */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Registro no Conselho <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <Stethoscope size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={conselho} 
                  onChange={e => setConselho(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 font-semibold"
                  placeholder="Ex: CRM-SP 12345 / COREN-MG 54321" 
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-600 uppercase tracking-wide">Senha Temporária</label>
              <input 
                type="password" 
                value={senha} 
                onChange={e => setSenha(e.target.value)} 
                required
                minLength={8}
                className="w-full px-4 py-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 font-semibold"
                placeholder="Mínimo 8 caracteres" 
              />
            </div>

          </div>

          {/* Aviso LGPD/segurança */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-xs font-bold text-blue-600 uppercase mb-1">Sobre o acesso</p>
            <p className="text-sm text-blue-700">
              O profissional receberá uma senha temporária. No primeiro acesso ao sistema, deverá redefini-la. 
              O CPF será o identificador único de login em todo o município.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50">
              <UserPlus size={20} />
              <span>{loading ? 'Cadastrando...' : 'Cadastrar Profissional'}</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
