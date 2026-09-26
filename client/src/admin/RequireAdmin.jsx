import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function RequireAdmin({ children }) {
  const [status, setStatus] = useState('checking');
  const location = useLocation();

  useEffect(() => {
    api
      .get('/auth/status')
      .then((data) => setStatus(data.authenticated ? 'ok' : 'denied'))
      .catch(() => setStatus('offline'));
  }, []);

  if (status === 'checking') return <p className="state-message">Checking your session…</p>;
  if (status === 'offline') {
    return <p className="state-message">Cannot reach the server. Make sure it is running (npm run dev), then refresh.</p>;
  }
  if (status === 'denied') return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return children;
}
