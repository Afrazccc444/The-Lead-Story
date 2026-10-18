import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ReadingProgress } from '../components/Cinematic.jsx';
import PageUnroll from '../components/PageUnroll.jsx';
import SocialLinks from '../components/newsletter/SocialLinks.jsx';
import { BackToTop, Lightbox, SearchBox, WebViewBanner } from '../components/reader/ReaderTools.jsx';
import WarmLightToggle from '../components/reader/WarmLightToggle.jsx';
import { useSite } from '../lib/useSite.js';

export default function PublicLayout() {
  const { pathname } = useLocation();
  const site = useSite();

  // Each new page starts at the top, like turning to a fresh page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <WebViewBanner />
      <header className="site-bar">
        <div className="site-bar__inner">
          {/* Fixed logo slot: shows the logo from Settings, or the masthead initial */}
          <Link to="/" className="site-bar__logo logo-slot" aria-label="The Lead Story — home">
            {site?.logo ? <img src={site.logo} alt="" /> : <span className="logo-slot__mark">L</span>}
          </Link>
          <Link to="/" className="site-bar__brand">
            The Lead Story <span>Global politics · Weekly</span>
          </Link>
          <nav className="site-bar__nav" aria-label="Primary">
            <NavLink to="/" end>
              Latest edition
            </NavLink>
            <NavLink to="/all">All</NavLink>
            <NavLink to="/videos">Video Reports</NavLink>
            <NavLink to="/publish">Publish with us</NavLink>
          </nav>
          <SearchBox />
          <SocialLinks className="social--bar" />
        </div>
        <ReadingProgress />
      </header>
      <main id="main" className="site__main">
        {/* key → a soft fade each time the page changes */}
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <p className="site-footer__brand">The Lead Story</p>
          <SocialLinks className="social--footer" />
          <p>
            An independent weekly briefing on global politics, produced as an IB Diploma Programme CAS project.
          </p>
          <p className="site-footer__disclosure">
            Every edition is researched and written by our student writers. Sources are listed in each edition’s
            bibliography — we encourage you to read the originals.
          </p>
          <p>
            Have truthful reporting but no platform? <Link to="/publish">Publish with us →</Link>
          </p>
          {/* Regulatory zone: contact / mailing address / legal text from Settings */}
          <div className="site-footer__legal">
            {site?.footer_text && <p className="site-footer__legal-text">{site.footer_text}</p>}
            <p>
              © {new Date().getFullYear()} The Lead Story · Created by Afraz Muhammed Cheema
            </p>
          </div>
        </div>
      </footer>
      <PageUnroll />
      <WarmLightToggle />
      <BackToTop />
      <Lightbox />
    </div>
  );
}
