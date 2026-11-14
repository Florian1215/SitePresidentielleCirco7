import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { logout, useAuth } from '../lib/auth';
import { CAMPAIGN } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import { LangSwitch } from './LangSwitch';
import './Header.scss';

const LINKS = [
  { path: '/programme', key: 'programme' },
  { path: '/circonscription', key: 'circonscription' },
  { path: '/inscription-listes-electorales', key: 'voter' },
  { path: '/blog', key: 'news' },
  { path: '/contact', key: 'contact' },
] as const;

export function Header() {
  const auth = useAuth();
  const i18n = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Le menu se referme à chaque navigation
  useEffect(() => setOpen(false), [location]);

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  const user = auth.user;
  return (
    <div className="site-header">
      {user && (
        <div className="userbar">
          <div className="container userbar-inner">
            <span>
              Connecté·e : <strong>{user.first_name || user.username}</strong>
            </span>
            <nav aria-label="Espace membre">
              {auth.canWrite && (
                <>
                  <Link to="/blog/ecrire">Écrire un article</Link>
                  <Link to="/blog?mine=1">Mes articles</Link>
                </>
              )}
              {user.is_staff && <a href="/admin/">Administration</a>}
              <button type="button" className="btn-link" onClick={onLogout}>
                Déconnexion
              </button>
            </nav>
          </div>
        </div>
      )}

      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo" aria-label={i18n.d.nav.logoAria}>
            <img className="logo-mark" src="/brand/circo7-rounded-192.webp" width="52" height="52" alt="" />
            <span className="logo-text">
              <span className="logo-top">La France insoumise</span>
              <span className="logo-bottom">{i18n.d.nav.logoSub}</span>
            </span>
          </Link>

          <button type="button" className="burger" aria-expanded={open} aria-controls="menu-principal" onClick={() => setOpen(!open)}>
            <span className="visually-hidden">{open ? i18n.d.nav.closeMenu : i18n.d.nav.openMenu}</span>
            <span className="burger-bar"></span>
          </button>

          <nav id="menu-principal" className={`nav${open ? ' open' : ''}`} aria-label={i18n.d.nav.mainMenu}>
            <ul>
              {LINKS.map((link) => (
                <li key={link.path}>
                  <NavLink to={link.path}>{i18n.d.nav[link.key]}</NavLink>
                </li>
              ))}
            </ul>
            <div className="nav-cta">
              <a href={CAMPAIGN.links.soutenir} target="_blank" rel="noopener" className="btn btn-rouge btn-sm">
                {i18n.d.nav.support}
              </a>
            </div>
          </nav>

          {/* Choix de la langue, tout à droite */}
          <LangSwitch className="lang" />
        </div>
      </header>
    </div>
  );
}
