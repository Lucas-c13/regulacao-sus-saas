import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import { KeyRound, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function RedefinirSenha() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Recebe o CPF passado pelo navigate hook do Login
  const cpfPadrao = location.state?.cpf || '';

  const [cpf, setCpf] = useState(cpfPadrao);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    
    if (novaSenha !== confirmarSenha) {
      setErro('As novas senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/redefinir-senha', { 
        cpf: cpf.replace(/\D/g, ''),
        senha_atual: senhaAtual,
        nova_senha: novaSenha
      });
      
      setSucesso(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3500);

    } catch (err: any) {
      setErro(err.response?.data?.detail || 'Erro ao redefinir. Verifique os dados fornecidos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      
      <div className="w-full max-w-md">
        
        <div className="flex justify-center mb-8">
           <div className="flex items-center gap-2 text-3xl font-black text-primary tracking-tighter">
             <ShieldCheck className="text-secondary" size={32} />
             Segurança <span className="text-secondary font-medium">B2B</span>
           </div>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-100">
          
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">
              Troca de Senha Exigida
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              Por norma de segurança (Zero Trust), altere a sua chave de acesso provisória.
            </p>
          </div>

          {sucesso ? (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-6 rounded-2xl text-center shadow-inner">
              <ShieldCheck className="mx-auto mb-4 text-emerald-600" size={40} />
              <h3 className="text-lg font-bold mb-2">Escudo Reforçado!</h3>
              <p className="text-sm font-medium">Sua nova senha foi gravada com sucesso. A redirecionar para a Autenticação...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {erro && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3 text-sm font-semibold">
                  <AlertTriangle className="text-red-500 shrink-0" size={18} />
                  <span>{erro}</span>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                  Credencial (CPF)
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none font-semibold"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  disabled={cpfPadrao !== ''}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                  Senha Provisória Atual
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none tracking-widest"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                  Nova Senha Definitiva
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none tracking-widest"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none tracking-widest"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Corresponder à superior"
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 bg-primary hover:bg-secondary text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <KeyRound size={20} />
                <span>{loading ? 'REGISTRANDO...' : 'TROCAR CHAVES DE ACESSO'}</span>
              </button>
            </form>
          )}
          
        </div>
        
        <div className="mt-8 text-center text-slate-400">
           <button onClick={() => navigate('/login')} className="text-sm font-semibold hover:text-primary transition-colors cursor-pointer">
             Voltar ao Portal Geral
           </button>
        </div>

      </div>
    </div>
  );
}
