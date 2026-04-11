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

// 👇 Interceptor de RESPOSTA Re-arquitetado para Router
api.interceptors.response.use(
  (response) => response, 
  (error) => {
    // Se o erro for 401 (Não Autorizado) -> Dispara o evento global
    // O InternalAuthObserver no App.tsx agarra nisto e redireciona de forma suave!
    if (error.response && error.response.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);