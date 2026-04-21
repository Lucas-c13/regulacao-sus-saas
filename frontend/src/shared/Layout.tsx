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
  CalendarDays,
  CalendarPlus,
  Stethoscope,
  CalendarX,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface Ubs {
  id_ubs: string;
  nome_ubs: string;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { logout, ubsAtiva, setUbsAtiva, userRole } = useAuth();
  const [minhasUbs, setMinhasUbs] = useState<Ubs[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const carregarDadosTenant = async () => {
      try {
        // Carrega tema do localStorage (o efeito "Uau" instantâneo)
        const temaStr = localStorage.getItem('tema');
        if (temaStr) {
          const tema = JSON.parse(temaStr);
          setLogoUrl(tema.logo_url);
        }

        const endpoint = userRole === 'admin_master' ? '/ubs/' : '/ubs/minhas-ubs';
        const response = await api.get(endpoint);
        const lista = response.data;
        setMinhasUbs(lista);

        if (!ubsAtiva && lista.length > 0) {
          setUbsAtiva(lista[0].id_ubs);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do sistema", error);
      }
    };

    carregarDadosTenant();
  }, [ubsAtiva, setUbsAtiva, userRole]);

  return (
    <div className="flex h-screen bg-slate-50/50">
      {/* SIDEBAR INTELIGENTE (RBAC) */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col shadow-xl shadow-slate-200/50 z-20">
        <div className="h-20 flex items-center justify-center border-b border-slate-50 px-6">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="max-h-12 w-auto object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary rounded-lg">
                <ShieldCheck className="text-white" size={24} />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tighter">
                SaaS <span className="text-primary">SUS</span>
              </h2>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Monitoramento</div>

          {/* Nível 1 e 2: Painel Gestor */}
          {(userRole === 'admin_master' || userRole === 'gestor_prefeitura') && (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <LayoutDashboard size={18} /><span>Dashboard</span>
              </NavLink>

              <NavLink to="/admin/configuracoes" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <Settings size={18} /><span>Branding e Regras</span>
              </NavLink>
            </>
          )}

          <div className="h-4"></div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Administração</div>

          {/* Nível 1: Setup Master */}
          {userRole === 'admin_master' && (
            <>
              <NavLink end to="/admin/ubs" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <Building2 size={18} /><span>Unidades de Saúde</span>
              </NavLink>

              <NavLink to="/admin/profissionais" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <UserPlus size={18} /><span>Profissionais</span>
              </NavLink>

              <NavLink to="/admin/escalas" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <CalendarDays size={18} /><span>Escalas Médicas</span>
              </NavLink>

              <NavLink to="/admin/especialidades" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <Stethoscope size={18} /><span>Especialidades</span>
              </NavLink>

              <NavLink to="/admin/feriados" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <CalendarX size={18} /><span>Feriados e Bloqueios</span>
              </NavLink>
            </>
          )}

          <div className="h-4"></div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Operação</div>

          {/* Nível 3: Operação de Ponta */}
          {(userRole === 'gestor_local' || userRole === 'admin_master' || userRole === 'profissional' || userRole === 'gestor_prefeitura') && (
            <>
              <NavLink to="/recepcao/agenda" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <Calendar size={18} /><span>Agenda Global</span>
              </NavLink>

              <NavLink to="/recepcao/novo-agendamento" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <CalendarPlus size={18} /><span>Novo Agendamento</span>
              </NavLink>

              <NavLink to="/recepcao/pacientes" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <Users size={18} /><span>Cidadãos (Mesa)</span>
              </NavLink>
            </>
          )}

        </nav>

        <div className="p-4 border-t border-slate-50">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl font-bold transition-all text-sm group">
            <LogOut size={18} className="group-hover:translate-x-1 transition-transform" /><span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
             <div className="w-1 h-6 bg-primary rounded-full"></div>
             <h1 className="text-sm font-black text-slate-700 uppercase tracking-[0.2em]">{
               userRole === 'admin_master' ? 'Central de Comando Mestre' :
                 userRole === 'gestor_prefeitura' ? 'Painel de Gestão Municipal' : 'Operação de Saúde'
             }</h1>
          </div>

          <div className="flex items-center space-x-3 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200">
            <MapPin size={16} className="text-primary" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade Ativa:</span>
            <select
              className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer min-w-[150px]"
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

        <div className="flex-1 overflow-auto bg-slate-50/50">
          {children}
        </div>
      </main>
    </div>
  );
}