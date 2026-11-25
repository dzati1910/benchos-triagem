import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { ChecklistsAdminPage } from './features/admin/ChecklistsAdminPage';
import { UsuariosAdminPage } from './features/admin/UsuariosAdminPage';
import { LoginPage } from './features/auth/LoginPage';
import { TriagensDashboardPage } from './features/triagens/TriagensDashboardPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

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
                <Route path="/admin/usuarios" element={<UsuariosAdminPage />} />
                <Route path="/admin/checklists" element={<ChecklistsAdminPage />} />
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
