import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { TriagensDashboardPage } from './features/triagens/TriagensDashboardPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

const PlaceholderPage: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-2">
    <h2 className="text-lg font-semibold text-white">{title}</h2>
    <p className="text-sm text-slate-400">{description}</p>
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/triagens" element={<TriagensDashboardPage />} />

              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route
                  path="/admin/usuarios"
                  element={
                    <PlaceholderPage
                      title="Gestão de Equipe"
                      description="Cadastro e controle de funcionários em preparação."
                    />
                  }
                />
                <Route
                  path="/admin/checklists"
                  element={
                    <PlaceholderPage
                      title="Gestão de Checklists"
                      description="Configuração de categorias e itens de teste em preparação."
                    />
                  }
                />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/triagens" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
