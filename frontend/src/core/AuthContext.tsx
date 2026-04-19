import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from './api';
import { jwtDecode } from 'jwt-decode';

// --- 1. A "PLANTA" DO TOKEN (Resolve erro DecodedToken) ---
interface DecodedToken {
  sub: string;           // CPF do profissional
  nome: string;
  role: string;          // 'admin_master' | 'gestor_prefeitura' | 'gestor_local' | 'profissional'
  tenant_id: string;     // UUID do município
  id_ubs: string | null;
  id_profissional: string;
  permissoes: Record<string, any>;
  exp: number;
}

// --- 2. A "PLANTA" DO CONTEXTO ---
interface AuthContextData {
  token: string | null;
  ubsAtiva: string;
  setUbsAtiva: (id: string) => void;
  login: (cpf: string, senha: string, id_municipio: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  userRole: string | null;
  userPayload: DecodedToken | null;
}

// --- 3. CRIAÇÃO DO CONTEXTO (Resolve erro AuthContext) ---
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [ubsAtiva, setUbsAtiva] = useState<string>(localStorage.getItem('ubsAtiva') || '');

  // --- 4. PERSISTÊNCIA DE TEMA (O efeito "Uau") ---
  useEffect(() => {
    const temaSalvo = localStorage.getItem('tema');
    if (temaSalvo) {
      try {
        const tema = JSON.parse(temaSalvo);
        const root = document.documentElement;
        root.style.setProperty('--color-primary', tema.cor_primaria);
        root.style.setProperty('--color-secondary', tema.cor_secundaria || tema.cor_primaria);
      } catch (e) {
        console.error("Erro ao aplicar tema", e);
      }
    }
  }, []);

  // Derivando estado do Token
  let userPayload: DecodedToken | null = null;
  let userRole: string | null = null;

  if (token) {
    try {
      userPayload = jwtDecode<DecodedToken>(token);
      userRole = userPayload.role || 'profissional';
    } catch {
      userRole = null;
    }
  }

  async function login(cpf: string, senha: string, id_municipio: string) {
    const params = new URLSearchParams();
    params.append('username', cpf);
    params.append('password', senha);
    params.append('client_id', id_municipio);

    const response = await api.post('/auth/login', params);
    const { access_token, tema_visual } = response.data;

    localStorage.setItem('token', access_token);

    if (tema_visual) {
      localStorage.setItem('tema', JSON.stringify(tema_visual));
      const root = document.documentElement;
      root.style.setProperty('--color-primary', tema_visual.cor_primaria);
      root.style.setProperty('--color-secondary', tema_visual.cor_secundaria || tema_visual.cor_primaria);
    }

    setToken(access_token);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('tema');
    localStorage.removeItem('ubsAtiva');

    // Reset para o azul padrão do sistema
    const root = document.documentElement;
    root.style.setProperty('--color-primary', '#0284c7');

    setToken(null);
    setUbsAtiva('');
  }

  const handleSetUbsAtiva = (id: string) => {
    localStorage.setItem('ubsAtiva', id);
    setUbsAtiva(id);
  };

  return (
    <AuthContext.Provider value={{
      token,
      ubsAtiva,
      setUbsAtiva: handleSetUbsAtiva,
      login,
      logout,
      isAuthenticated: !!token,
      userRole,
      userPayload
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- 5. O HOOK (Resolve erro AuthContext no uso) ---
export const useAuth = () => useContext(AuthContext);

