import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from './api';

interface AuthContextData {
  token: string | null;
  ubsAtiva: string;
  setUbsAtiva: (id: string) => void;
  login: (cpf: string, senha: string, id_municipio: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  // Guarda a última UBS que ele estava a ver (para se ele der F5 na página não perder)
  const [ubsAtiva, setUbsAtiva] = useState<string>(localStorage.getItem('ubsAtiva') || '');

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
    const root = document.documentElement;
    root.style.setProperty('--color-primary', '#0284c7');
    setToken(null);
    setUbsAtiva('');
  }

  // Função para mudar a UBS e guardar no navegador
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
      isAuthenticated: !!token 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);