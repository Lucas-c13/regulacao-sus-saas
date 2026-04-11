import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from './api';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub: string;
  role: string;
  id_municipio: string | null;
  id_ubs: string | null;
  is_senha_provisoria: boolean;
  exp: number;
}

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

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [ubsAtiva, setUbsAtiva] = useState<string>(localStorage.getItem('ubsAtiva') || '');

  // Derivando estado através do Token em tempo real
  let userPayload: DecodedToken | null = null;
  let userRole: string | null = null;
  if (token) {
    try {
      userPayload = jwtDecode<DecodedToken>(token);
      
      // O JWT real injecta as permissoes JSONB, não a string 'role' solta.
      // Vamos traduzir o JSONB numa role forte para o React Router (RBAC):
      const perm = (userPayload as any).permissoes || {};
      
      if (userPayload.sub === '11122233344' || perm.is_admin_master) {
         userRole = 'admin_master'; // God Mode (CPF Master do Seed)
      } else if (perm.is_gestor_local) {
         userRole = 'gestor_local'; // Diretor da UBS
      } else {
         userRole = 'profissional'; // Médico / Rececionista
      }
      
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
    
    // Atualização de Tema Visual Isolada
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
    
    // Devolve o tema base
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

export const useAuth = () => useContext(AuthContext);