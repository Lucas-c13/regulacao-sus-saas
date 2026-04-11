import { useState, useEffect } from 'react';
import { useAuth } from '../../core/AuthContext';
import { api } from '../../core/api';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Activity, AlertTriangle, ChevronRight } from 'lucide-react';

interface Vinculo {
  id_municipio: string;
  nome_municipio: string;
}

export default function Login() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [idMunicipioSelecionado, setIdMunicipioSelecionado] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [buscandoMunicipios, setBuscandoMunicipios] = useState(false);
  
  const { login, isAuthenticated, userRole } = useAuth();
  const navigate = useNavigate();

  const cpfLimpo = cpf.replace(/\D/g, '');

  // Redirecionamento automático se já estiver Logado
  useEffect(() => {
    if (isAuthenticated && userRole) {
      if (userRole === 'admin_master' || userRole === 'gestor_prefeitura') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/recepcao/agenda', { replace: true });
      }
    }
  }, [isAuthenticated, userRole, navigate]);

  useEffect(() => {
    const buscarMunicipios = async () => {
      // Bate no interceptor de check se tivermos 11 dígitos
      if (cpfLimpo.length === 11) {
        setBuscandoMunicipios(true);
        setErro('');
        try {
          const response = await api.post('/auth/verificar-acessos', { cpf: cpfLimpo });
          const listaVinculos = response.data.vinculos;
          setVinculos(listaVinculos);
          setIdMunicipioSelecionado(listaVinculos[0].id_municipio);
        } catch (error: any) {
          setVinculos([]);
          setErro('CPF não possui credenciais ativas do SUS registradas.');
        } finally {
          setBuscandoMunicipios(false);
        }
      } else {
        setVinculos([]);
        setIdMunicipioSelecionado('');
      }
    };

    buscarMunicipios();
  }, [cpfLimpo]);

  const handleLoginFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      await login(cpfLimpo, senha, idMunicipioSelecionado);
      
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        const decoded: any = jwtDecode(savedToken);
        const perm = decoded.permissoes || {};
        
        if (decoded.sub === '11122233344' || perm.is_admin_master || perm.is_gestor_prefeitura) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/recepcao/agenda', { replace: true });
        }
      }

    } catch (error: any) {
      if (error.response?.status === 428) {
         navigate('/redefinir-senha', { state: { cpf: cpfLimpo } });
         return;
      }
      setErro('Chave de Acesso bloqueada ou incorreta.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      
      <div className="w-full max-w-md">
        
        {/* LOGO SIMPLIFICADA */}
        <div className="flex justify-center mb-8">
           <div className="flex items-center gap-2 text-3xl font-black text-primary tracking-tighter">
             <Activity className="text-secondary" size={32} />
             SaaS <span className="text-secondary font-medium">Regulação</span>
           </div>
        </div>

        {/* CONTAINER PREMIUML B2B */}
        <div className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-gray-100">
          
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">
              Autenticação de Operador
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              Insira a sua credencial para aceder à Regulação Local
            </p>
          </div>

          {erro && (
            <div className="mb-6 bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl flex items-center space-x-3 text-sm font-semibold">
              <AlertTriangle className="text-red-500 shrink-0" size={18} />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleLoginFinal} className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Credencial (CPF)
              </label>
              <input
                type="text"
                autoComplete="username"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl 
                         focus:ring-2 focus:ring-primary/50 transition-all font-semibold outline-none"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="111.222.333-44"
                maxLength={14}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Palavra-Passe
              </label>
              <input
                type="password"
                autoComplete="current-password"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl 
                         focus:ring-2 focus:ring-primary/50 transition-all font-semibold outline-none tracking-widest"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {/* SELETOR DE MUNICÍPIO (Aparece dinamicamente se o CPF existir no PostgreSQL) */}
            <div className={`transition-all duration-500 overflow-hidden ${vinculos.length > 0 ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="pt-2">
                <label className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2 block">
                  {buscandoMunicipios ? '🔍 A Localizar Portal...' : 'Vínculo Confirmado'}
                </label>
                <select
                  className="w-full px-4 py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl 
                           focus:ring-2 focus:ring-emerald-500/50 transition-all font-bold outline-none cursor-pointer"
                  value={idMunicipioSelecionado}
                  onChange={(e) => setIdMunicipioSelecionado(e.target.value)}
                  required={vinculos.length > 0}
                >
                  {vinculos.map((v) => (
                    <option key={v.id_municipio} value={v.id_municipio}>
                      {v.nome_municipio}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || vinculos.length === 0}
              className="w-full mt-4 bg-primary hover:bg-secondary text-white font-bold py-4 rounded-xl shadow-lg 
                       transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'A CARREGAR DADOS...' : 'ENTRAR NO SISTEMA'}</span>
              {!loading && <ChevronRight size={20} />}
            </button>
            
          </form>
          
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
              Acesso Seguro · Arquitetura Multi-Tenant
            </p>
        </div>

      </div>
    </div>
  );
}