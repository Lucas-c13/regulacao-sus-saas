import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:8000',
});

// Interceptor de REQUISIÇÃO (que você já tem)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 👇 NOVO: Interceptor de RESPOSTA
api.interceptors.response.use(
  (response) => response, // Se der sucesso, apenas repassa a resposta
  (error) => {
    // Se o erro for 401 (Não Autorizado), limpamos o cache e mandamos pro Login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('ubsAtiva');
      localStorage.removeItem('tema');
      
      // Só redireciona se não estivermos já na página de login
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login'; 
      }
    }
    return Promise.reject(error);
  }
);