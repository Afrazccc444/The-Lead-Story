import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';

/** The Admin app: the owner's control room for accounts, requests, analytics and every article. */
export default function OwnerLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Refreshed on every page change, so the badge stays current.
  const { data } = useApi(`/owner/requests?status=pending&_=${pathname}`);
  const pending = data?.requests?.length ?? 0;

  async function signOut() {
    await api.post('/auth/logout').catch(() => {});
    navigate('/admin/login', { replace: true, state: { from: '/owner' } });
  }

  return (
    <div className="admin admin--owner">
      <header className="admin-bar">
        <Link to="/owner" className="admin-bar__brand">
          The Lead Story <span>Admin</span>
        </Link>
        <nav className="admin-bar__nav" aria-label="Admin">
          <NavLink to="/owner" end>
            Overview
          </NavLink>
          <NavLink to="/owner/requests">
            Requests{pending > 0 && <span className="count-badge" aria-label={`${pending} pending`}>{pending}</span>}
          </NavLink>
          <NavLink to="/owner/accounts">Accounts</NavLink>
          <NavLink to="/owner/articles">Articles</NavLink>
          <NavLink to="/owner/publishing">Publishing</NavLink>
          <Link to="/admin">Editor’s desk</Link>
          <a href="/" target="_blank" rel="noopener noreferrer">
            View site ↗
          </a>
        </nav>
        <div className="admin-bar__end">
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
