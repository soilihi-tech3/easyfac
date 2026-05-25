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
import Login from './components/auth/Login';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/factures" element={<ProtectedRoute><Factures /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/voyages" element={<ProtectedRoute><Voyages /></ProtectedRoute>} />
            <Route path="/depenses" element={<ProtectedRoute><Depenses /></ProtectedRoute>} />
            <Route path="/epargnes" element={<ProtectedRoute><Epargnes /></ProtectedRoute>} />
            <Route path="/statistiques" element={<ProtectedRoute><Statistiques /></ProtectedRoute>} />
            <Route path="/parametres" element={<ProtectedRoute><Parametres /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          </Routes>
        </Router>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
