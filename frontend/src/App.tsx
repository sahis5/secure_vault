import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { useAppStore } from './store/useAppStore';

// Guard that redirects to /login if no token
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAppStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const DummyPage = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="glass-card p-12 text-center max-w-md w-full">
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-gray-400">This module is part of the architecture and is coming soon.</p>
    </div>
  </div>
);

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/files"    element={<DummyPage title="Secure File Vault" />} />
          <Route path="/security" element={<DummyPage title="Security Center" />} />
          <Route path="/admin"    element={<DummyPage title="Admin Panel" />} />
          <Route path="/settings" element={<DummyPage title="Account Settings" />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
