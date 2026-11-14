import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { logout, useAuth } from '../lib/auth';
import { CAMPAIGN } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import { LangSwitch } from './LangSwitch';

const LINKS = [
  { path: '/programme', key: 'programme' },
  { path: '/circonscription', key: 'circonscription' },
  { path: '/inscription-listes-electorales', key: 'voter' },
  { path: '/blog', key: 'news' },
  { path: '/contact', key: 'contact' },
] as const;

/** Liens du menu ; page en cours : coins arrondis en haut seulement, la ligne rouge restant droite en bas. */
const NAV_LINK =
  'block rounded-lg px-2.5 py-2 text-[15px] font-bold whitespace-nowrap text-noir no-underline hover:bg-lavande hover:text-violet aria-[current=page]:rounded-b-none aria-[current=page]:text-violet aria-[current=page]:shadow-[inset_0_-3px_0_var(--color-rouge)] max-[1180px]:px-2 max-[1180px]:py-3 max-[1180px]:text-[18px]';

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
    <div className="contents">
      {user && (
        <div className="bg-noir text-[14px] text-creme">
          <div className="site-container flex flex-wrap justify-between gap-2 py-2">
            <span>
              Connecté·e : <strong>{user.first_name || user.username}</strong>
            </span>
            <nav
              aria-label="Espace membre"
              className="flex flex-wrap gap-4 [&_a]:font-medium [&_a]:text-creme [&_a]:no-underline [&_a:hover]:underline"
            >
              {auth.canWrite && (
                <>
                  <Link to="/blog/ecrire">Écrire un article</Link>
                  <Link to="/blog?mine=1">Mes articles</Link>
                </>
              )}
              {user.is_staff && <a href="/admin/">Administration</a>}
              <button type="button" className="btn-link font-medium text-creme no-underline hover:underline" onClick={onLogout}>
                Déconnexion
              </button>
            </nav>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-gris bg-creme">
        <div className="site-container flex min-h-[76px] items-center justify-center gap-10 max-[1180px]:justify-between max-[1180px]:gap-6 max-[520px]:gap-2.5">
          <Link
            to="/"
            className="group flex items-center gap-3 text-violet no-underline max-[520px]:min-w-0 max-[520px]:flex-auto max-[520px]:gap-2"
            aria-label={i18n.d.nav.logoAria}
          >
            <img
              className="h-[52px] w-[52px] shrink-0 transition-transform duration-200 group-hover:-rotate-6 max-[520px]:h-11 max-[520px]:w-11"
              src="/brand/circo7-rounded-192.webp"
              width="52"
              height="52"
              alt=""
            />
            <span className="flex flex-col leading-[1.1] max-[520px]:min-w-0">
              <span className="font-titre text-[22px] uppercase max-[520px]:text-[18px]">La France insoumise</span>
              <span className="text-[12px] font-bold whitespace-nowrap text-rouge max-[520px]:text-[11px] max-[520px]:leading-[1.2] max-[520px]:whitespace-normal">
                {i18n.d.nav.logoSub}
              </span>
            </span>
          </Link>

          <button
            type="button"
            className="relative order-3 -ml-3.5 hidden h-11 w-11 cursor-pointer rounded-[10px] border-0 bg-violet max-[1180px]:block max-[520px]:ml-0 max-[520px]:shrink-0"
            aria-expanded={open}
            aria-controls="menu-principal"
            onClick={() => setOpen(!open)}
          >
            <span className="visually-hidden">{open ? i18n.d.nav.closeMenu : i18n.d.nav.openMenu}</span>
            <span className="absolute top-[21px] left-[11px] h-0.5 w-[22px] bg-creme before:absolute before:-top-[7px] before:left-0 before:h-0.5 before:w-[22px] before:bg-creme before:content-[''] after:absolute after:top-[7px] after:left-0 after:h-0.5 after:w-[22px] after:bg-creme after:content-['']"></span>
          </button>

          <nav
            id="menu-principal"
            className={`flex items-center gap-5 max-[1180px]:absolute max-[1180px]:top-full max-[1180px]:right-0 max-[1180px]:left-0 max-[1180px]:flex-col max-[1180px]:items-stretch max-[1180px]:border-b max-[1180px]:border-gris max-[1180px]:bg-creme max-[1180px]:px-gutter max-[1180px]:pt-3 max-[1180px]:pb-6 max-[1180px]:shadow-site ${open ? '' : 'max-[1180px]:hidden'}`}
            aria-label={i18n.d.nav.mainMenu}
          >
            <ul className="m-0 flex list-none gap-1 p-0 max-[1180px]:flex-col">
              {LINKS.map((link) => (
                <li key={link.path}>
                  <NavLink to={link.path} className={NAV_LINK}>
                    {i18n.d.nav[link.key]}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3.5 max-[1180px]:justify-between">
              <a href={CAMPAIGN.links.soutenir} target="_blank" rel="noopener" className="btn btn-rouge btn-sm">
                {i18n.d.nav.support}
              </a>
            </div>
          </nav>

          {/* Choix de la langue, tout à droite */}
          <LangSwitch className="max-[1180px]:order-2 max-[1180px]:ml-auto max-[520px]:shrink-0" />
        </div>
      </header>
    </div>
  );
}
