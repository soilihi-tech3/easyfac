import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import Clients from './components/clients/Clients';
import Factures from './components/factures/Factures';
import Voyages from './components/voyages/Voyages';
import Depenses from './components/depenses/Depenses';
import Epargnes from './components/epargnes/Epargnes';
import Statistiques from './components/statistiques/Statistiques';
import Parametres from './components/parametres/Parametres';
import Users from './components/users/Users';
import FlyerGenerator from './components/flyer/FlyerGenerator';
import Communiques from './components/communiques/Communiques';
import Remboursements from './components/remboursements/Remboursements';
import Login from './components/auth/Login';
import SuperAdminDashboard from './components/superadmin/SuperAdminDashboard';
import ComingSoonModule from './components/common/ComingSoonModule';
import { useApp } from './context/AppContext';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') {
    return <SuperAdminDashboard />;
  }
  return <Layout>{children}</Layout>;
};

const ModuleGuard = ({ moduleKey, moduleName, children }) => {
  const { isModuleActive } = useApp();
  if (moduleKey && !isModuleActive(moduleKey)) {
    return <ComingSoonModule moduleName={moduleName} />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/factures" element={<ProtectedRoute><ModuleGuard moduleKey="factures" moduleName="Factures"><Factures /></ModuleGuard></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><ModuleGuard moduleKey="clients" moduleName="Clients"><Clients /></ModuleGuard></ProtectedRoute>} />
            <Route path="/voyages" element={<ProtectedRoute><ModuleGuard moduleKey="voyages" moduleName="Voyages"><Voyages /></ModuleGuard></ProtectedRoute>} />
            <Route path="/depenses" element={<ProtectedRoute><ModuleGuard moduleKey="depenses" moduleName="Dépenses"><Depenses /></ModuleGuard></ProtectedRoute>} />
            <Route path="/remboursements" element={<ProtectedRoute><ModuleGuard moduleKey="remboursements" moduleName="Remboursements"><Remboursements /></ModuleGuard></ProtectedRoute>} />
            <Route path="/communiques" element={<ProtectedRoute><ModuleGuard moduleKey="communiques" moduleName="Communiqués"><Communiques /></ModuleGuard></ProtectedRoute>} />
            <Route path="/flyer" element={<ProtectedRoute><ModuleGuard moduleKey="flyer" moduleName="Créateur de Flyer"><FlyerGenerator /></ModuleGuard></ProtectedRoute>} />
            <Route path="/epargnes" element={<ProtectedRoute><ModuleGuard moduleKey="epargne" moduleName="Épargne"><Epargnes /></ModuleGuard></ProtectedRoute>} />
            <Route path="/statistiques" element={<ProtectedRoute><ModuleGuard moduleKey="statistiques" moduleName="Statistiques"><Statistiques /></ModuleGuard></ProtectedRoute>} />
            <Route path="/parametres" element={<ProtectedRoute><ModuleGuard moduleKey="parametres" moduleName="Paramètres"><Parametres /></ModuleGuard></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><ModuleGuard moduleKey="employes" moduleName="Gestion des Employés"><Users /></ModuleGuard></ProtectedRoute>} />
          </Routes>
        </Router>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
