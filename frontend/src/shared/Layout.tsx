import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '../core/AuthContext';
import { api } from '../core/api';
import { Calendar, LayoutDashboard, LogOut, Users, MapPin } from 'lucide-react';

interface Ubs {
  id_ubs: string;
  nome_ubs: string;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { logout, ubsAtiva, setUbsAtiva } = useAuth();
  const [minhasUbs, setMinhasUbs] = useState<Ubs[]>([]);

  // Carrega as UBSs em que este médico/rececionista trabalha
  useEffect(() => {
    const carregarUbs = async () => {
      try {
        const response = await api.get('/ubs/minhas-ubs');
        const lista = response.data;
        setMinhasUbs(lista);
        
        // UX Premium: Se ele não tem UBS ativa, seleciona a primeira da lista automaticamente!
        if (!ubsAtiva && lista.length > 0) {
          setUbsAtiva(lista[0].id_ubs);
        }
      } catch (error) {
        console.error("Erro ao carregar UBSs", error);
      }
    };
    carregarUbs();
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-surface border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <h2 className="text-xl font-black text-primary tracking-tight">
            SaaS <span className="font-medium text-textMain">Regulação</span>
          </h2>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button className="w-full flex items-center space-x-3 px-4 py-3 bg-primary/10 text-primary rounded-lg font-semibold transition-colors">
            <Calendar size={20} /><span>Agenda do Dia</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-textMain hover:bg-gray-50 rounded-lg font-medium transition-colors">
            <Users size={20} /><span>Pacientes</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-textMain hover:bg-gray-50 rounded-lg font-medium transition-colors">
            <LayoutDashboard size={20} /><span>Painel Gestor</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 text-textMain hover:bg-red-50 hover:text-red-600 rounded-lg font-semibold transition-colors">
            <LogOut size={20} /><span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* HEADER SUPERIOR COM O COMBOBOX INTELIGENTE */}
        <header className="h-16 bg-surface border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-0">
          <h1 className="text-lg font-semibold text-textMain">Recepção</h1>
          
          <div className="flex items-center space-x-3 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
            <MapPin size={18} className="text-primary" />
            <span className="text-sm font-medium text-gray-500">Unidade:</span>
            <select 
              className="bg-transparent text-sm font-bold text-textMain outline-none cursor-pointer w-48"
              value={ubsAtiva}
              onChange={(e) => setUbsAtiva(e.target.value)}
            >
              {minhasUbs.length === 0 && <option value="">A carregar...</option>}
              {minhasUbs.map((ubs) => (
                <option key={ubs.id_ubs} value={ubs.id_ubs}>{ubs.nome_ubs}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}