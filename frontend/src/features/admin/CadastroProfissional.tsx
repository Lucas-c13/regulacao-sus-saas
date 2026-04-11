import { useState } from 'react';
import { api } from '../../core/api';
import { UserPlus, ShieldCheck, Mail, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../core/AuthContext';

export default function CadastroProfissional() {
  const { userPayload } = useAuth();
  
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [conselho, setConselho] = useState('');
  const [senha, setSenha] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso(false);
    setLoading(true);

    try {
      await api.post('/profissionais/', {
        id_municipio: userPayload?.id_municipio,
        nome: nome,
        cpf: cpf.replace(/\D/g, ''),
        conselho: conselho || null,
        senha_hash: senha // A API de backend fará o hash
      });

      setSucesso(true);
      setNome(''); setCpf(''); setConselho(''); setSenha('');
    } catch (err: any) {
      setErro(err.response?.data?.detail || "Erro crítico ao cadastrar Profissional.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
        <div className="p-4 bg-primary/10 rounded-xl text-primary">
          <UserPlus size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Recrutamento Clínico</h2>
          <p className="text-slate-500 font-medium">Cadastre Médicos e Recepcionistas na rede de Saúde (Isolamento de Base de Dados Ativo)</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        
        {sucesso && (
           <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-200 p-4 rounded-xl flex items-center space-x-3">
             <ShieldCheck className="text-emerald-500" />
             <span className="font-semibold">Credencial Ativa! O Profissional já se pode autenticar no nosso SaaS.</span>
           </div>
        )}

        {erro && (
           <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3">
             <ShieldAlert className="text-red-500" />
             <span className="font-semibold">{erro}</span>
           </div>
        )}

        <form onSubmit={handleCadastrar} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nome Completo</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
                placeholder="Ex: Dr. João da Silva" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">CPF (Login Único)</label>
              <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} required maxLength={14}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold tracking-widest"
                placeholder="000.000.000-00" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Registo de Conselho (Opcional)</label>
              <input type="text" value={conselho} onChange={e => setConselho(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-semibold"
                placeholder="Ex: CRM-SP 12345" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Senha Temporária</label>
              <div className="relative">
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required
                  className="w-full pl-10 pr-4 py-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-semibold"
                  placeholder="********" />
                <Mail className="absolute left-3 top-3.5 text-amber-500" size={18} />
              </div>
            </div>

          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
             <p className="text-xs text-slate-500 text-center font-bold">⚠️ O Backend assinalará `is_senha_provisoria = true`. O Gestor deverá exigir redefinição no primeiro acesso.</p>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button type="submit" disabled={loading}
              className="bg-primary hover:bg-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
              {loading ? 'A REGISTAR...' : 'GRAVAR PROFISSIONAL DE SAÚDE'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
