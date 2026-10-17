import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { accountName, useSessionUser } from './session.js';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useSessionUser();

  async function signOut() {
    await api.post('/auth/logout').catch(() => {});
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="admin">
      <header className="admin-bar">
        <Link to="/admin" className="admin-bar__brand">
          The Lead Story <span>Editor’s desk</span>
        </Link>
        <nav className="admin-bar__nav" aria-label="Admin">
          <NavLink to="/admin" end>
            Editions
          </NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
          {user?.role === 'owner' && <Link to="/owner">Admin app</Link>}
          <a href="/" target="_blank" rel="noopener noreferrer">
            View site ↗
          </a>
        </nav>
        <div className="admin-bar__end">
          <span className="admin-bar__user" title={`Signed in as ${user?.username}`}>
            {accountName(user)}
          </span>
          <button type="button" className="btn btn--ghost btn--small" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="admin__main">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
