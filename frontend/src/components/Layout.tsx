import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, LogOut, ShieldCheck, Users, Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
  }`;

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="no-print border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-white leading-tight">
                  BenchOS{' '}
                  <span className="text-xs font-normal text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                    Distribuição
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Sistema de Triagem Técnica &amp; Bancada de Testes
                </p>
              </div>
            </div>

            <nav className="flex items-center gap-1" aria-label="Navegação principal">
              <NavLink to="/triagens" className={navLinkClass}>
                <Wrench className="w-4 h-4" />
                Triagens
              </NavLink>

              {isAdmin && (
                <>
                  <NavLink to="/admin/usuarios" className={navLinkClass}>
                    <Users className="w-4 h-4" />
                    Equipe
                  </NavLink>
                  <NavLink to="/admin/checklists" className={navLinkClass}>
                    <ClipboardList className="w-4 h-4" />
                    Checklists
                  </NavLink>
                </>
              )}
            </nav>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-white leading-tight">{user.nome}</div>
                <span
                  className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    isAdmin
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {isAdmin ? 'Administrador' : 'Funcionário'}
                </span>
              </div>

              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {children ?? <Outlet />}
      </main>
    </div>
  );
};
