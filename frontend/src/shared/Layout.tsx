import type { ReactNode } from 'react';
import { useAuth } from '../core/AuthContext';
import { Calendar, LayoutDashboard, LogOut, Users } from 'lucide-react';

export default function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      
      {/* SIDEBAR (Barra Lateral) */}
      <aside className="w-64 bg-surface border-r border-gray-200 flex flex-col shadow-sm z-10">
        {/* Logotipo / Nome do Sistema */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <h2 className="text-xl font-black text-primary tracking-tight">
            SaaS <span className="font-medium text-textMain">Regulação</span>
          </h2>
        </div>

        {/* Menu de Navegação */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Item Ativo (Exemplo: Agenda) */}
          <button className="w-full flex items-center space-x-3 px-4 py-3 bg-primary/10 text-primary rounded-lg font-semibold transition-colors">
            <Calendar size={20} />
            <span>Agenda do Dia</span>
          </button>
          
          {/* Itens Inativos */}
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-textMain hover:bg-gray-50 rounded-lg font-medium transition-colors">
            <Users size={20} />
            <span>Pacientes</span>
          </button>

          <button className="w-full flex items-center space-x-3 px-4 py-3 text-textMain hover:bg-gray-50 rounded-lg font-medium transition-colors">
            <LayoutDashboard size={20} />
            <span>Painel Gestor</span>
          </button>
        </nav>

        {/* Rodapé da Sidebar (Botão de Sair) */}
        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={logout} 
            className="w-full flex items-center space-x-3 px-4 py-3 text-textMain hover:bg-red-50 hover:text-red-600 rounded-lg font-semibold transition-colors"
          >
            <LogOut size={20} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL DE CONTEÚDO */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header Superior Simples */}
        <header className="h-16 bg-surface border-b border-gray-200 flex items-center px-8 shadow-sm z-0">
          <h1 className="text-lg font-semibold text-textMain">Recepção UBS</h1>
        </header>

        {/* Área onde as telas filhas serão renderizadas */}
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}