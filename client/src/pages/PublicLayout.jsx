import { NavLink, Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="topbar" aria-label="Primary">
        <div className="topbar__inner">
          <NavLink to="/" end className="topbar__link">
            Latest edition
          </NavLink>
          <NavLink to="/all" className="topbar__link">
            All
          </NavLink>
        </div>
      </nav>
      <main id="main" className="site__main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <p className="site-footer__brand">The Lead Story</p>
          <p>
            An independent weekly briefing on global politics, produced as an IB Diploma Programme CAS project.
          </p>
          <p className="site-footer__disclosure">
            Every edition is researched and written by our student writers. Sources are listed in each edition’s
            bibliography — we encourage you to read the originals.
          </p>
        </div>
      </footer>
    </div>
  );
}
