import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import BrandLockup from '../ui/BrandLogo';
import Footer from './Footer';
import { getCompanyInformation } from '../../lib/database';
import BusinessStructuredData from '../public/BusinessStructuredData';
import { useDashboardPath } from '../../hooks/useDashboardPath';

/**
 * Minimal chrome for guest-accessible pages — a slim top bar with the brand,
 * in-page section scrolling for home page ("Trip Schedules", "Track", "Book Cargo"),
 * site page links ("Help", "About"), and "Admin Login" (or "Go to Dashboard").
 */
const NAV_ITEMS = [
  { label: 'Trip Schedules', href: '/#schedules-section', targetId: 'schedules-section' },
  { label: 'Track', href: '/#track-section', targetId: 'track-section', focusId: 'lx-track-input' },
  { label: 'Book Cargo', href: '/#booking-section', targetId: 'booking-section' },
  { label: 'Help', href: '/faq' },
  { label: 'About', href: '/about' },
];

const PublicShell = ({ children, wide = false, links = false }) => {
  const [company, setCompany] = useState(null);
  const location = useLocation();
  const dashboardPath = useDashboardPath();

  useEffect(() => {
    let mounted = true;
    getCompanyInformation()
      .then(info => { if (mounted) setCompany(info); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleBrandClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.history.replaceState(null, '', '/');
    }
  };

  const handleNavClick = (e, item) => {
    if (item.targetId && location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById(item.targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (item.focusId) {
          setTimeout(() => {
            const input = document.getElementById(item.focusId);
            if (input) {
              input.focus();
              input.select();
            }
          }, 350);
        }
        window.history.replaceState(null, '', '#' + item.targetId);
      }
    }
  };

  const isLinkActive = (item) => {
    if (item.href === '/faq') return location.pathname === '/faq';
    if (item.href === '/about') return location.pathname === '/about';
    return false;
  };

  return (
    <div className={`public-shell${links ? ' public-shell--links' : ''}`}>
      <header className="public-shell-header">
        <Link
          to="/"
          onClick={handleBrandClick}
          className="public-shell-brand"
          aria-label="CargoExpress PH home"
        >
          <BrandLockup size={32} />
        </Link>
        {links && (
          <nav className="public-shell-pages" aria-label="Site pages">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                onClick={(e) => handleNavClick(e, item)}
                className={`public-shell-page-link${isLinkActive(item) ? ' active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <nav className="public-shell-nav" aria-label="Account">
          {dashboardPath ? (
            <Link to={dashboardPath} className="btn btn-primary btn-sm public-shell-dashboard">
              <span><span className="public-shell-dashboard-prefix">Go to </span>Dashboard</span>
            </Link>
          ) : (
            <Link to="/login" className="btn btn-outline btn-sm">Admin Login</Link>
          )}
        </nav>
      </header>

      <main className={`public-shell-main${wide ? ' public-shell-main--wide' : ''}`}>
        {children || <Outlet />}
      </main>

      <Footer companyName={company?.name} info={company} />
      <BusinessStructuredData info={company} />
    </div>
  );
};

export default PublicShell;
