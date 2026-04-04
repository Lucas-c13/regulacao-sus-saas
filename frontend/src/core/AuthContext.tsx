import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from './api';

interface AuthContextData {
  token: string | null;
  login: (cpf: string, senha: string, id_municipio: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  async function login(cpf: string, senha: string, id_municipio: string) {
    const params = new URLSearchParams();
    params.append('username', cpf);
    params.append('password', senha);
    params.append('client_id', id_municipio); // O nosso hack do OAuth2 para o Tenant

    const response = await api.post('/auth/login', params);
    const { access_token, tema_visual } = response.data;

    // Guarda o token e o tema
    localStorage.setItem('token', access_token);
    if (tema_visual) {
      localStorage.setItem('tema', JSON.stringify(tema_visual));
      // Injeta as cores da prefeitura instantaneamente no CSS!
      const root = document.documentElement;
      root.style.setProperty('--color-primary', tema_visual.cor_primaria);
      root.style.setProperty('--color-secondary', tema_visual.cor_secundaria || tema_visual.cor_primaria);
    }
    
    setToken(access_token);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('tema');
    // Volta para o azul padrão
    const root = document.documentElement;
    root.style.setProperty('--color-primary', '#0284c7');
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);