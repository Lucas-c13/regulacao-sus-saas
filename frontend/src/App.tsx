import { AuthProvider, useAuth } from './core/AuthContext';
import Login from './features/auth/Login';
import Layout from './shared/Layout';

function Rotas() {
  const { isAuthenticated } = useAuth();

  // Proteção: Se não tem JWT, fica no Login
  if (!isAuthenticated) {
    return <Login />;
  }

  // Se passou, entra no Layout Padrão!
  return (
    <Layout>
      {/* Este bloco é o 'children' que será injetado no meio do ecrã */}
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-4xl">
        <h2 className="text-2xl font-bold text-textMain mb-2">
          Bem-vindo à sua Recepção!
        </h2>
        <p className="text-gray-500 mb-6">
          O seu token JWT foi validado e a estrutura do layout com as cores da prefeitura está ativa.
        </p>
        
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
          <p className="text-primary font-medium">
            💡 Próxima Missão: Substituir este bloco de texto pela listagem real da Agenda do Dia, conectada com a rota do FastAPI.
          </p>
        </div>
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