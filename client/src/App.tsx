import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import PaymentTypes from './pages/PaymentTypes';
import Payments from './pages/Payments';
import Receivables from './pages/Receivables';
import Users from './pages/Users';
import { authAPI } from './api';
import { connectSSE, disconnectSSE } from './sse';
import type { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.me()
        .then(res => {
          setUser(res.data);
          connectSSE();
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    connectSSE();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    disconnectSSE();
  };

  if (loading) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard user={user} />} />
          <Route path="companies" element={<Companies user={user} />} />
          <Route path="payment-types" element={<PaymentTypes user={user} />} />
          <Route path="payments" element={<Payments user={user} />} />
          <Route path="receivables" element={<Receivables />} />
          {user.role === 'super_admin' && (
            <Route path="users" element={<Users />} />
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
