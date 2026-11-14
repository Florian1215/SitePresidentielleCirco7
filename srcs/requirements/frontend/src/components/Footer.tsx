import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { CAMPAIGN } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import type { FooterLinks } from '../lib/models';
import { FOOTER_ICONS } from './footer-icons';
import type { SvgIcon } from './footer-icons';

const COL = 'flex-[1_1_160px]';
const COL_TITLE =
  'm-0 mb-3.5 border-b border-[rgba(255,252,244,.35)] pb-2.5 font-titre text-[22px] text-jaune uppercase';
const COL_LIST = 'grid gap-2.5';
const EXT = 'inline-flex items-baseline gap-2';

function Icon({ icon, className }: { icon: SvgIcon; className: string }) {
  return (
    <svg className={className} viewBox={icon.viewBox} aria-hidden="true" focusable="false">
      <path d={icon.d} />
    </svg>
  );
}

const External = () => <Icon icon={FOOTER_ICONS['external']} className="h-3 w-3 shrink-0 fill-current opacity-80" />;

export function Footer() {
  const i18n = useI18n();
  const t = i18n.d.footer;
  const c = CAMPAIGN;
  const [l, setLinks] = useState<FooterLinks>({ friend_sites: [], socials: [] });

  useEffect(() => {
    let alive = true;
    api.footerLinks().then((links) => alive && setLinks(links));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <footer className="bg-violet pt-12 pb-6 text-creme [&_a]:text-creme [&_a]:no-underline [&_a:hover]:text-jaune [&_a:hover]:underline [&_ul]:m-0 [&_ul]:list-none [&_ul]:p-0">
      <div className="site-container flex flex-wrap gap-10">
        <div className="flex flex-[1.4_1_260px] flex-col items-start gap-5 max-[700px]:basis-full">
          <Link to="/" className="flex items-center gap-3 hover:text-creme! hover:no-underline!" aria-label={t.home}>
            <img className="h-24 w-24 rounded-md" src="/brand/circo7-square-192.webp" width="96" height="96" alt="" loading="lazy" />
            <span>
              <span className="block font-titre text-[26px] leading-none uppercase">La France insoumise</span>
              <span className="mt-1 block text-[13px] font-bold text-jaune">{i18n.d.nav.logoSub}</span>
            </span>
          </Link>
          <ul className="grid gap-1.5 text-[14px]">
            <li>
              <Link to="/mentions-legales">{t.legal}</Link>
            </li>
            <li>
              <Link to="/connexion">{t.writers}</Link>
            </li>
          </ul>
        </div>

        <nav className={COL} aria-label={t.site}>
          <p className={COL_TITLE}>{t.site}</p>
          <ul className={COL_LIST}>
            <li><Link to="/programme">{t.programme}</Link></li>
            <li><Link to="/circonscription">{t.circonscription}</Link></li>
            <li><Link to="/inscription-listes-electorales">{t.voteAbroad}</Link></li>
            <li><Link to="/blog">{t.newsAgenda}</Link></li>
            <li><Link to="/contact">{t.contact}</Link></li>
          </ul>
        </nav>

        <div className={COL}>
          <p className={COL_TITLE}>{t.act}</p>
          <ul className={COL_LIST}>
            <li>
              <a href={c.links.soutenir} target="_blank" rel="noopener" className={EXT}>
                <External />
                {t.supportCandidacy}
              </a>
            </li>
            <li><Link to="/inscription-listes-electorales">{t.registerLists}</Link></li>
            <li>
              <a href={c.links.actionPopulaire} target="_blank" rel="noopener" className={EXT}>
                <External />
                {t.joinGroup}
              </a>
            </li>
            <li><a href={'mailto:' + c.contactEmail}>{t.writeUs}</a></li>
          </ul>
        </div>

        {/* Sites amis (admin Django → Sites amis) */}
        {l.friend_sites.length > 0 && (
          <div className={COL}>
            <p className={COL_TITLE}>{t.friendSites}</p>
            <ul className={COL_LIST}>
              {l.friend_sites.map((site) => (
                <li key={site.id}>
                  <a href={site.url} target="_blank" rel="noopener" className={EXT}>
                    <External />
                    {site.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Réseaux sociaux (admin Django → Réseaux sociaux) */}
        {l.socials.length > 0 && (
          <div className={COL}>
            <p className={COL_TITLE}>{t.networks}</p>
            <ul className={COL_LIST}>
              {l.socials.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener me" className="inline-flex items-center gap-2.5">
                    <Icon icon={FOOTER_ICONS[s.network] ?? FOOTER_ICONS['other']} className="h-4 w-4 shrink-0 fill-current" />
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="site-container">
        <p className="mt-12 mb-0 border-t border-[rgba(255,252,244,.25)] pt-5 text-[13px] opacity-85">
          {i18n.f(t.copyright, { year: new Date().getFullYear(), circo: i18n.d.common.circo })}
        </p>
      </div>
    </footer>
  );
}
