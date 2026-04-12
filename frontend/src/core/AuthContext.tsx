import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from './api';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub: string;           // CPF do profissional
  nome: string;
  role: string;          // 'admin_master' | 'gestor_prefeitura' | 'gestor_local' | 'profissional'
  tenant_id: string;     // UUID do município (era id_municipio — corrigido)
  id_municipio?: string; // alias legado para compatibilidade
  id_ubs: string | null;
  id_profissional: string;
  permissoes: Record<string, any>;
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
      
      // O JWT já traz 'role' definido pelo backend diretamente
      // Prioridade: role do JWT > permissões JSONB > fallback
      if (userPayload.role) {
        userRole = userPayload.role;
      } else {
        // Fallback caso seja token antigo sem campo 'role'
        const perm = userPayload.permissoes || {};
        if (perm.admin_master) userRole = 'admin_master';
        else if (perm.is_gestor_prefeitura) userRole = 'gestor_prefeitura';
        else if (perm.is_gestor_local) userRole = 'gestor_local';
        else userRole = 'profissional';
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