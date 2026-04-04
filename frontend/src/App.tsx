import { AuthProvider, useAuth } from './core/AuthContext';
import Login from './features/auth/Login';
import Layout from './shared/Layout';
import AgendaDia from './features/recepcao/AgendaDia'; // <-- 1. Importamos a Tabela Sênior

function Rotas() {
  const { isAuthenticated } = useAuth();

  // Proteção: Se não tem JWT, fica no Login
  if (!isAuthenticated) {
    return <Login />;
  }

  // Se passou, entra no Layout Padrão!
  return (
    <Layout>
      {/* 2. Removemos o texto provisório e chamamos a Agenda do Dia! */}
      <div className="max-w-6xl mx-auto h-full">
        <AgendaDia />
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Rotas />
    </AuthProvider>
  );
}