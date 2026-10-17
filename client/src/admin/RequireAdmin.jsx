import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { SessionContext } from './session.js';

/**
 * Lets the page through only for a signed-in account. With `owner`, only the
 * owner gets in (the Admin app); editors are shown a polite "no access" page.
 */
export default function RequireAdmin({ children, owner = false }) {
  const [state, setState] = useState({ status: 'checking', user: null });
  const location = useLocation();

  useEffect(() => {
    api
      .get('/auth/status')
      .then((data) => setState({ status: data.authenticated ? 'ok' : 'denied', user: data.user }))
      .catch(() => setState({ status: 'offline', user: null }));
  }, []);

  if (state.status === 'checking') return <p className="state-message">Checking your session…</p>;
  if (state.status === 'offline') {
    return <p className="state-message">Cannot reach the server. Make sure it is running, then refresh.</p>;
  }
  if (state.status === 'denied') return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (owner && state.user?.role !== 'owner') {
    return (
      <div className="login">
        <div className="login__card">
          <p className="section-label">Admin</p>
          <h1 className="login__title">Owner only</h1>
          <p className="login__intro">The Admin app is only available to the owner of The Lead Story.</p>
          <Link to="/admin" className="btn btn--primary btn--block">
            Go to your Editor’s desk
          </Link>
        </div>
      </div>
    );
  }
  return <SessionContext.Provider value={state.user}>{children}</SessionContext.Provider>;
}
