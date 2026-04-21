import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '../core/AuthContext';
import { api } from '../core/api';
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  Users,
  MapPin,
  Building2,
  UserPlus,
  HeartPulse,
  CalendarDays,
  Stethoscope,
  CalendarX,
  Settings // <-- Ícone adicionado aqui
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface Ubs {
  id_ubs: string;
  nome_ubs: string;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { logout, ubsAtiva, setUbsAtiva, userRole } = useAuth();
  const [minhasUbs, setMinhasUbs] = useState<Ubs[]>([]);

  useEffect(() => {
    const carregarUbs = async () => {
      try {
        // Se for admin master, busca todas as UBSs do município, se não, busca apenas as vinculadas
        const endpoint = userRole === 'admin_master' ? '/ubs/' : '/ubs/minhas-ubs';
        const response = await api.get(endpoint);
        const lista = response.data;
        setMinhasUbs(lista);

        if (!ubsAtiva && lista.length > 0) {
          setUbsAtiva(lista[0].id_ubs);
        }
      } catch (error) {
        console.error("Erro ao carregar UBSs", error);
      }
    };

    carregarUbs();
  }, [ubsAtiva, setUbsAtiva, userRole]);

  return (
    <div className="flex h-screen bg-background">
      {/* SIDEBAR INTELIGENTE (RBAC) */}
      <aside className="w-64 bg-surface border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <h2 className="text-xl font-black text-primary tracking-tight">
            SaaS <span className="font-medium text-textMain"></span>
          </h2>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">

          {/* Nível 1 e 2: Painel Gestor */}
          {(userRole === 'admin_master' || userRole === 'gestor_prefeitura') && (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <LayoutDashboard size={20} /><span>Painel Gestor</span>
              </NavLink>

              {/* --- NOVO MENU AQUI --- */}
              <NavLink to="/admin/configuracoes" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <Settings size={20} /><span>Configurações</span>
              </NavLink>
            </>
          )}

          {/* Nível 1: Setup Master */}
          {userRole === 'admin_master' && (
            <>
              <NavLink end to="/admin/ubs" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <Building2 size={20} /><span>Unidades de Saúde</span>
              </NavLink>

              <NavLink to="/admin/ubs/nova" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <Building2 size={20} /><span>Nova UBS</span>
              </NavLink>

              <NavLink to="/admin/profissionais" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <UserPlus size={20} /><span>Gestão de Profissionais</span>
              </NavLink>

              <NavLink to="/admin/escalas" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <CalendarDays size={20} /><span>Gestão de Escalas</span>
              </NavLink>

              <NavLink to="/admin/especialidades" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <Stethoscope size={20} /><span>Especialidades</span>
              </NavLink>

              <NavLink to="/admin/feriados" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <CalendarX size={20} /><span>Gestão de Feriados</span>
              </NavLink>
            </>
          )}

          {/* Nível 3: Operação de Ponta */}
          {(userRole === 'gestor_local' || userRole === 'admin_master' || userRole === 'profissional') && (
            <>
              <NavLink to="/recepcao/agenda" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <Calendar size={20} /><span>Agenda Operacional</span>
              </NavLink>

              <NavLink to="/recepcao/novo-agendamento" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <Users size={20} /><span>Novo Agendamento</span>
              </NavLink>

              <NavLink to="/recepcao/pacientes/novo" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <UserPlus size={20} /><span>Novo Paciente</span>
              </NavLink>

              <NavLink to="/recepcao/pacientes" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-textMain hover:bg-gray-50'}`}>
                <HeartPulse size={20} /><span>Pacientes</span>
              </NavLink>
            </>
          )}

        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 text-textMain hover:bg-red-50 hover:text-red-600 rounded-lg font-semibold transition-colors">
            <LogOut size={20} /><span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-surface border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-0">
          <h1 className="text-lg font-semibold text-textMain capitalize">{
            userRole === 'admin_master' ? 'Visão Administrativa Mestre' :
              userRole === 'gestor_prefeitura' ? 'Painel de Prefeitura' : 'Portal de Saúde'
          }</h1>

          <div className="flex items-center space-x-3 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
            <MapPin size={18} className="text-primary" />
            <span className="text-sm font-medium text-gray-500">Unidade:</span>
            <select
              className="bg-transparent text-sm font-bold text-textMain outline-none cursor-pointer w-48"
              value={ubsAtiva}
              onChange={(e) => setUbsAtiva(e.target.value)}
            >
              {minhasUbs.length === 0 && <option value="">Carregando...</option>}
              {minhasUbs.map((ubs) => (
                <option key={ubs.id_ubs} value={ubs.id_ubs}>{ubs.nome_ubs}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8 bg-slate-50/50">
          {children}
        </div>
      </main>
    </div>
  );
}