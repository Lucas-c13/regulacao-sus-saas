import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import Login from './features/auth/Login';
import Layout from './shared/Layout';
import AgendaDia from './features/recepcao/AgendaDia';
import DashboardGerencial from './features/dashboard/DashboardGerencial';
import CadastroUBS from './features/admin/CadastroUBS';
import CadastroProfissional from './features/admin/CadastroProfissional';
import GestaoEscalas from './features/admin/GestaoEscalas';
import NovoAgendamento from './features/recepcao/NovoAgendamento';
import CadastroPaciente from './features/recepcao/CadastroPaciente';
import RedefinirSenha from './features/auth/RedefinirSenha';
import ListaProfissionais from './features/admin/ListaProfissionais';

// Proteção Robusta de Componentes via React Router
function ProtectedRoute({ children, allowedRoles }: { children: ReactNode, allowedRoles?: string[] }) {
  const { isAuthenticated, userRole } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Gestores não podem ver tela de recepcionista e vice versa, fallback:
    return <Navigate to="/encaminhador" replace />; 
  }
  return children;
}

// Injetor de Interceptação da API (Captura Erro 401 do Axios em tempo real)
function InternalAuthObserver() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      navigate('/login');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate, logout]);

  return null;
}

// Mapa Global de Rotas
function RoutesMap() {
  return (
    <BrowserRouter>
      <InternalAuthObserver />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        
        {/* Painéis Administrativos (Nível 1 e Nível 2) */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['admin_master', 'gestor_prefeitura']}>
            <Layout>
               <DashboardGerencial />
            </Layout>
          </ProtectedRoute>
        } />

        {/* Setup de Unidades Master Nível 1 */}
        <Route path="/admin/ubs/nova" element={
          <ProtectedRoute allowedRoles={['admin_master']}>
            <Layout>
               <CadastroUBS />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/profissionais" element={
          <ProtectedRoute allowedRoles={['admin_master']}>
            <Layout>
               <ListaProfissionais />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/profissionais/novo" element={
          <ProtectedRoute allowedRoles={['admin_master']}>
            <Layout>
               <CadastroProfissional />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/escalas" element={
          <ProtectedRoute allowedRoles={['admin_master', 'gestor_local']}>
            <Layout>
               <GestaoEscalas />
            </Layout>
          </ProtectedRoute>
        } />

        {/* Ecrãs Operacionais (Nível 3) */}
        <Route path="/recepcao/agenda" element={
          <ProtectedRoute allowedRoles={['admin_master', 'gestor_local', 'profissional']}>
            <Layout>
              <AgendaDia />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/recepcao/novo-agendamento" element={
          <ProtectedRoute allowedRoles={['admin_master', 'gestor_local', 'profissional']}>
            <Layout>
               <NovoAgendamento />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/recepcao/pacientes/novo" element={
          <ProtectedRoute allowedRoles={['admin_master', 'gestor_local', 'profissional']}>
            <Layout>
               <CadastroPaciente />
            </Layout>
          </ProtectedRoute>
        } />

        {/* Direcionadores Globais */}
        <Route path="/encaminhador" element={
          <ProtectedRoute>
            <div className="p-10 text-center"><p className="text-gray-500">A redirecionar pelo seu Cargo de Acesso...</p></div>
          </ProtectedRoute>
        } />
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// O Núcleo
export default function App() {
  return (
    <AuthProvider>
      <RoutesMap />
    </AuthProvider>
  );
}