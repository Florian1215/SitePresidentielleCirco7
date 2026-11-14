import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { CATEGORY_ICONS } from '../data/category-icons';
import type { CategoryIcon } from '../data/category-icons';
import { CAMPAIGN } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import { useProgramme } from '../lib/programme';
import { usePageTitle } from '../lib/title';
import './Programme.scss';

function CatIcon({ icon }: { icon: CategoryIcon }) {
  const i = CATEGORY_ICONS[icon];
  return (
    <svg className="cat-icon" viewBox={i.viewBox} aria-hidden="true" focusable="false">
      <path d={i.d} />
    </svg>
  );
}

function scrollTo(slug: string, event?: MouseEvent) {
  const el = document.getElementById(slug);
  if (!el) return;
  event?.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Chemin complet : avec <base href="/">, un simple '#slug' renverrait vers l'accueil
  history.replaceState(history.state, '', location.pathname + location.search + '#' + slug);
}

export default function Programme() {
  usePageTitle('programme');
  const i18n = useI18n();
  const t = i18n.d.programme;
  const { categories } = useProgramme();

  useEffect(() => {
    // La page étant chargée paresseusement, on rejoue l'ancre (#ecologie, #monde…) une fois rendue.
    const hash = location.hash.slice(1);
    if (!hash) return;
    const timer = setTimeout(() => scrollTo(decodeURIComponent(hash)));
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="page-programme">
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="lead">{t.lead}</p>
          <nav className="cat-nav" aria-label={t.navAria}>
            {categories.map((cat) => (
              <a key={cat.slug} href={'#' + cat.slug} className={'cat-' + cat.color} onClick={(e) => scrollTo(cat.slug, e)}>
                <CatIcon icon={cat.icon} />
                {cat.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="section">
        <div className="container cats">
          {categories.map((cat, i) => (
            <article key={cat.slug} className={'cat cat-' + cat.color} id={cat.slug}>
              <h2 className="cat-title">
                <CatIcon icon={cat.icon} />
                <span>
                  <small>{i18n.f(t.part, { n: i + 1 })}</small>
                  {cat.title}
                </span>
              </h2>
              <p className="cat-intro">{cat.intro}</p>
              <ul className="cat-keys">
                {cat.mesures.filter((m) => m.key).map((m) => (
                  <li key={m.title}>{m.title}</li>
                ))}
              </ul>
              <details>
                <summary>{i18n.f(t.seeDetail, { n: cat.mesures.length })}</summary>
                <ol className="mesures">
                  {cat.mesures.map((m) => (
                    <li key={m.title}>
                      <h3>{m.title}</h3>
                      <p>{m.text}</p>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="section-sm bg-violet">
        <div className="container cta">
          <h2>{t.ctaTitle}</h2>
          <div className="btn-row">
            <Link to="/inscription-listes-electorales" className="btn btn-creme">
              {t.registerBtn}
            </Link>
            <a href={CAMPAIGN.links.programmeNational} target="_blank" rel="noopener" className="btn btn-outline">
              {t.nationalBtn}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
