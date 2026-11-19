import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { CATEGORY_ICONS } from '../data/category-icons';
import type { CategoryIcon } from '../data/category-icons';
import { CAMPAIGN } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import { useProgramme } from '../lib/programme';
import { usePageTitle } from '../lib/title';

function CatIcon({ icon, className = '' }: { icon: CategoryIcon; className?: string }) {
  const i = CATEGORY_ICONS[icon];
  return (
    <svg
      className={`h-[1em] w-[1em] shrink-0 fill-(--bordure) ${className}`}
      viewBox={i.viewBox}
      aria-hidden="true"
      focusable="false"
    >
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
    <div>
      <section className="page-hero">
        <div className="site-container hero-copy">
          <span className="eyebrow">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="lead">{t.lead}</p>
          <nav className="hero-chips mt-2 flex flex-wrap gap-2" aria-label={t.navAria}>
            {categories.map((cat) => (
              <a
                key={cat.slug}
                href={'#' + cat.slug}
                className={`inline-flex items-center gap-2 rounded-md border border-(--bordure) bg-(--fond) px-3.5 py-2 text-[14px] font-bold text-(--titre) no-underline transition-transform duration-150 hover:translate-y-px cat-${cat.color}`}
                onClick={(e) => scrollTo(cat.slug, e)}
              >
                <CatIcon icon={cat.icon} />
                {cat.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="section">
        <div className="site-container grid max-w-[900px] gap-14">
          {categories.map((cat, i) => (
            <article
              key={cat.slug}
              className={`scroll-mt-[110px] overflow-hidden rounded-site border border-(--bordure) bg-white cat-${cat.color}`}
              id={cat.slug}
            >
              <h2 className="mt-0 mb-6 flex items-center gap-[18px] border-b border-(--bordure) bg-(--fond) px-[clamp(20px,4vw,40px)] py-[18px] text-[clamp(26px,3.6vw,38px)] leading-[1.1] text-(--titre)">
                <CatIcon icon={cat.icon} className="text-[1.3em]" />
                <span>
                  <small className="mb-1 block font-texte text-[13px] font-bold tracking-[0.08em] text-(--bordure)">
                    {i18n.f(t.part, { n: i + 1 })}
                  </small>
                  {cat.title}
                </span>
              </h2>
              <p className="mx-[clamp(20px,4vw,40px)] mb-4 text-[18px] leading-[1.55]">{cat.intro}</p>
              <ul className="mx-[clamp(20px,4vw,40px)] mt-0 mb-6 grid gap-2 pl-[1.2em] marker:text-(--bordure)">
                {cat.mesures
                  .filter((m) => m.key)
                  .map((m) => (
                    <li key={m.title} className="text-[18px] leading-[1.35] font-bold">
                      {m.title}
                    </li>
                  ))}
              </ul>
              <details className="mx-[clamp(20px,4vw,40px)] mb-7 border-t border-gris pt-4">
                <summary className="w-fit cursor-pointer font-bold text-violet hover:underline">
                  {i18n.f(t.seeDetail, { n: cat.mesures.length })}
                </summary>
                <ol className="mx-0 mt-5 mb-0 grid gap-[18px] pl-[1.6em] marker:font-bold marker:text-(--titre)">
                  {cat.mesures.map((m) => (
                    <li key={m.title}>
                      <h3 className="mt-0 mb-1 font-texte text-[17px] font-bold text-noir">{m.title}</h3>
                      <p className="m-0 text-[15px] leading-[1.55] text-texte">{m.text}</p>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          ))}
        </div>
      </section>

      {/* Programme complet : le livre « L'Avenir en commun » (site national) */}
      <section className="section-sm pt-0">
        <div className="site-container flex items-center justify-center gap-4 max-[600px]:flex-col max-[600px]:text-center">
          {/* Le livre rétrécit si la place manque (largeur max. 250 px), en gardant ses proportions */}
          <a
            href={CAMPAIGN.links.programmeComplet}
            target="_blank"
            rel="noopener"
            tabIndex={-1}
            aria-hidden="true"
            className="block w-[250px] max-w-[40%] min-w-0 shrink max-[600px]:w-[200px] max-[600px]:max-w-[60%]"
          >
            <img
              src="/img/web/book-300.webp"
              srcSet="/img/web/book-300.webp 300w, /img/web/book-600.webp 600w"
              sizes="(max-width: 600px) 200px, 250px"
              width="250"
              height="277"
              alt=""
              loading="lazy"
              className="block aspect-[927/1028] h-auto w-full object-contain transition-transform hover:scale-[1.03]"
            />
          </a>
          <div>
            <h2 className="mb-4">{t.fullTitle}</h2>
            <a href={CAMPAIGN.links.programmeComplet} target="_blank" rel="noopener" className="btn">
              {t.fullBtn} ↗
            </a>
          </div>
        </div>
      </section>

      {/* Bandeau pleine largeur vers le simulateur de l'impôt universel */}
      <section id="impot-universel" className="section-sm bg-lavande">
        <div className="site-container grid grid-cols-[auto_minmax(0,640px)_auto] items-center justify-center gap-[clamp(20px,4vw,40px)] max-[760px]:grid-cols-1 max-[760px]:justify-items-center max-[760px]:text-center">
          <span
            className="grid h-20 w-20 place-items-center rounded-full bg-white font-titre text-[44px] text-rouge max-[760px]:h-16 max-[760px]:w-16 max-[760px]:text-[34px]"
            aria-hidden="true"
          >
            €
          </span>
          <div>
            <span className="mb-1 block text-[13px] font-bold tracking-[0.08em] text-rouge uppercase">{t.impotEyebrow}</span>
            <h2 className="m-0 text-[clamp(26px,3.4vw,38px)]">{t.impotTitle}</h2>
            <p className="mt-2 mb-0 text-[16px] leading-[1.5]">{t.impotText}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Link to="/impot-universel" className="btn btn-rouge">
              {t.impotBtn} →
            </Link>
            <span className="text-[13px] font-bold">{t.impotMeta}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
