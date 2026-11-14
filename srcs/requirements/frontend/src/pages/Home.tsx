import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { EventCard } from '../components/EventCard';
import { Photo } from '../components/Photo';
import { CATEGORY_ICONS } from '../data/category-icons';
import { api } from '../lib/api';
import { CAMPAIGN, COUNTRIES, daysUntil } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import type { CampaignEvent } from '../lib/models';
import { useProgramme } from '../lib/programme';
import { usePageTitle } from '../lib/title';

/** Affiches du haut de page : chacune ouvre la partie correspondante du programme. */
const POSTER_SLUGS = ['securite-sociale', 'futur', 'ecologie', 'monde'];

/**
 * Affiches : couleur, position et inclinaison de chacune, puis place de la mention « cliquer »
 * (à droite pour la n° 2 dont le texte est à droite ; en haut pour les n° 3 et 4 dont le titre est en bas).
 */
const POSTER_STYLES = [
  { poster: 'top-[4%] left-0 w-[58%] -rotate-6 justify-start bg-violet', cta: 'bottom-[18px] left-[22px] translate-y-1.5' },
  {
    poster: 'top-0 left-[34%] z-1 w-[58%] rotate-4 items-end justify-start bg-rouge text-right',
    cta: 'right-[22px] bottom-[18px] translate-y-1.5',
  },
  { poster: 'top-[34%] left-[2%] z-2 w-[48%] rotate-3 justify-end bg-vert', cta: 'top-[18px] left-[22px] -translate-y-1.5' },
  { poster: 'top-[38%] left-[51%] z-3 w-[48%] -rotate-4 justify-end bg-noir', cta: 'top-[18px] left-[22px] -translate-y-1.5' },
];

/** Mesure phare : coche dans un rond de la couleur de la partie. */
const KEY_ITEM =
  "relative pl-[26px] text-[15px] leading-[1.35] font-bold before:absolute before:top-px before:left-0 before:grid before:h-[18px] before:w-[18px] before:place-items-center before:rounded-full before:bg-(--fond) before:text-[12px] before:font-black before:text-(--bordure) before:content-['✓']";

export default function Home() {
  usePageTitle('home');
  const i18n = useI18n();
  const t = i18n.d.home;
  const programme = useProgramme();
  const c = CAMPAIGN;

  /** Les trois urgences, reliées à leur partie du programme (couleur, picto, mesures phares). */
  const urgences = useMemo(
    () =>
      programme.urgences.map((u) => {
        const cat = programme.categories.find((x) => x.slug === u.slug)!;
        return { ...u, cat, keys: cat.mesures.filter((m) => m.key).slice(0, 3), count: cat.mesures.length };
      }),
    [programme],
  );

  const posters = t.posters.map((p, i) => ({ ...p, slug: POSTER_SLUGS[i] }));

  const [events, setEvents] = useState<CampaignEvent[]>([]);
  useEffect(() => {
    let alive = true;
    api.events().then((e) => alive && setEvents(e));
    return () => {
      alive = false;
    };
  }, []);

  /** Bandeau : la date en grand, le nombre de jours restants en petit. */
  const keyDates = useMemo(() => {
    const e = CAMPAIGN.election;
    const keyDate = (iso: string, label: string, note = '') => ({
      label,
      note,
      day: new Date(iso + 'T12:00:00').getDate(),
      month: i18n.date(iso, { month: 'short' }).replace('.', ''),
      weekday: i18n.date(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      daysLeft: daysUntil(iso),
    });
    return [
      keyDate(
        e.registrationDeadlineOnline,
        t.deadline,
        i18n.f(t.consulate, { date: i18n.date(e.registrationDeadlineConsulate, { day: 'numeric', month: 'long' }) }),
      ),
      keyDate(e.firstRound, t.firstRound),
    ];
  }, [i18n, t]);

  // ---------- Compteur de soutiens (Action populaire) ----------
  const soutien = useRef<HTMLElement>(null);
  const [supporters, setSupporters] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState(0);
  const supportersRef = useRef<number | null>(null);
  const counted = useRef(false);

  useEffect(() => {
    let alive = true;
    const timers: number[] = [];
    let raf = 0;

    const load = () =>
      api.supportersCount().then(
        ({ count }) => {
          if (!alive || count === null) return;
          supportersRef.current = count;
          setSupporters(count);
          // Après la première animation, le chiffre suit simplement les mises à jour
          if (counted.current) setDisplayCount(count);
        },
        () => {},
      );
    load();
    const timer = window.setInterval(load, 30_000);

    const countUp = () => {
      if (!alive) return;
      const target = supportersRef.current;
      if (target === null) {
        // Chiffre pas encore reçu : on réessaie un peu plus tard
        timers.push(window.setTimeout(countUp, 300));
        return;
      }
      counted.current = true;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDisplayCount(target);
        return;
      }
      const start = performance.now();
      const from = Math.round(target * 0.8);
      const duration = 1600;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        // La valeur peut avoir été mise à jour entre-temps
        const goal = supportersRef.current ?? target;
        setDisplayCount(Math.round(from + (goal - from) * eased));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    // Le chiffre défile quand la section arrive à l'écran
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        countUp();
      },
      { threshold: 0.4 },
    );
    if (soutien.current) observer.observe(soutien.current);
    return () => {
      alive = false;
      clearInterval(timer);
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div>
      {/* HERO */}
      <section className="overflow-hidden pt-[clamp(40px,7vw,96px)] pb-[clamp(56px,8vw,104px)]">
        <div className="site-container grid grid-cols-[1.25fr_1fr] items-center gap-12 max-[900px]:grid-cols-1">
          <div>
            <span className="eyebrow">{i18n.f(t.eyebrow, { circo: i18n.d.common.circo })}</span>
            <h1>
              {t.titleA} <span className="hl-violet">{t.titleHl}</span> {t.titleB}
            </h1>
            <p className="lead mt-2 mb-8 max-w-[560px]">
              {t.leadA} <span className="hl">{t.leadHl}</span>.
            </p>
            <div className="btn-row">
              <Link to="/programme" className="btn">
                {t.programmeBtn}
              </Link>
              <Link to="/inscription-listes-electorales" className="btn btn-outline">
                {t.registerBtn}
              </Link>
            </div>
          </div>

          <nav className="relative min-h-[420px] max-[900px]:min-h-[340px] max-[900px]:max-w-[460px]" aria-label={t.postersAria}>
            {posters.map((p, i) => (
              <Link
                key={p.slug + p.top}
                className={`group absolute flex aspect-[3/4] cursor-pointer flex-col rounded-site p-[22px] font-titre leading-[0.95] text-creme uppercase no-underline shadow-[0_18px_40px_rgba(33,35,32,0.18)] transition-[rotate,translate,scale,box-shadow] duration-250 ease-bounce hover:z-10 hover:-translate-y-2.5 hover:scale-[1.04] hover:rotate-0 hover:shadow-[0_28px_50px_rgba(33,35,32,0.3)] focus-visible:z-10 focus-visible:-translate-y-2.5 focus-visible:scale-[1.04] focus-visible:rotate-0 focus-visible:shadow-[0_28px_50px_rgba(33,35,32,0.3)] focus-visible:outline-4 focus-visible:outline-offset-3 focus-visible:outline-jaune motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 ${POSTER_STYLES[i].poster}`}
                to={{ pathname: '/programme', hash: p.slug }}
                aria-label={i18n.f(t.posterAria, { title: p.top + ' ' + p.bottom })}
              >
                <span className="text-[22px]">{p.top}</span>
                <strong className="text-[clamp(28px,3.3vw,40px)] font-normal">{p.bottom}</strong>
                <em
                  className={`absolute font-texte text-[13px] font-bold normal-case opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${POSTER_STYLES[i].cta}`}
                  aria-hidden="true"
                >
                  {t.posterCta}
                </em>
              </Link>
            ))}
            <span className="sticker pointer-events-none absolute top-[24%] right-[-2%] z-4 text-[24px]" aria-hidden="true">
              {i18n.f(t.sticker, { n: COUNTRIES.length })}
            </span>
          </nav>
        </div>
      </section>

      {/* DATES CLÉS */}
      <section className="section-violet py-7">
        <div className="site-container flex flex-wrap items-center justify-between gap-6">
          {keyDates.map((d, i) => (
            <div className="flex items-center gap-4" key={d.label}>
              {/* Petite feuille de calendrier : le jour en grand, le mois dessous */}
              <span
                className={`flex min-w-[78px] flex-col items-center rounded-[10px] bg-jaune px-2.5 pt-1.5 pb-2 text-noir shadow-[0_6px_0_rgba(0,0,0,0.2)] ${i ? 'rotate-2' : '-rotate-3'}`}
                aria-hidden="true"
              >
                <span className="font-titre text-[48px] leading-none">{d.day}</span>
                <span className="font-titre text-[18px] leading-none uppercase">{d.month}</span>
              </span>
              <span className="text-[15px] leading-[1.35] font-bold uppercase">
                {d.label}
                <br />
                <small className="text-[14px] font-normal normal-case">
                  {d.weekday} · <strong className="text-jaune">{i18n.f(t.daysLeft, { n: d.daysLeft })}</strong>
                  {d.note && <> · {d.note}</>}
                </small>
              </span>
            </div>
          ))}
          <Link to="/inscription-listes-electorales" className="btn btn-creme">
            {t.checkRegistration}
          </Link>
        </div>
      </section>

      {/* TROIS URGENCES */}
      <section className="section">
        <div className="site-container">
          <div className="section-head">
            <span className="eyebrow">{t.programmeEyebrow}</span>
            <h2>{t.urgencesTitle}</h2>
          </div>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6 p-0">
            {urgences.map((u, i) => {
              const icon = CATEGORY_ICONS[u.cat.icon];
              return (
                <li key={u.slug} className="flex">
                  <Link
                    className={`group flex w-full flex-col overflow-hidden rounded-[14px] border border-(--bordure) bg-white text-noir no-underline shadow-site transition-[translate,rotate,box-shadow] duration-250 ease-bounce hover:-translate-y-1.5 hover:shadow-[0_22px_44px_rgba(33,35,32,0.16)] focus-visible:-translate-y-1.5 focus-visible:-rotate-[0.6deg] focus-visible:shadow-[0_22px_44px_rgba(33,35,32,0.16)] focus-visible:outline-4 focus-visible:outline-offset-3 focus-visible:outline-jaune motion-reduce:hover:translate-y-0 motion-reduce:hover:rotate-0 cat-${u.cat.color} ${i === 1 ? 'hover:rotate-[0.6deg]' : 'hover:-rotate-[0.6deg]'}`}
                    to={{ pathname: '/programme', hash: u.slug }}
                  >
                    <div className="relative border-b border-(--bordure) bg-(--fond) pt-[22px] pr-[90px] pb-5 pl-6">
                      <span className="absolute top-[18px] right-[18px] grid h-14 w-14 place-items-center rounded-full bg-white shadow-[0_0_0_3px_var(--bordure)] transition-[rotate,scale] duration-300 ease-bounce group-hover:-rotate-12 group-hover:scale-110 group-focus-visible:-rotate-12 group-focus-visible:scale-110">
                        <svg
                          className="h-[26px] w-[26px] fill-(--bordure)"
                          viewBox={icon.viewBox}
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d={icon.d} />
                        </svg>
                      </span>
                      <h3 className="m-0 text-[clamp(26px,2.6vw,32px)] leading-[1.05] text-(--titre) uppercase">{u.title}</h3>
                    </div>
                    <div className="flex flex-1 flex-col px-6 pt-[18px] pb-[22px]">
                      <p className="mt-0 mb-3.5 text-texte">{u.text}</p>
                      <ul className="m-0 mb-5 grid list-none gap-2 p-0">
                        {u.keys.map((m) => (
                          <li key={m.title} className={KEY_ITEM}>
                            {m.title}
                          </li>
                        ))}
                      </ul>
                      <span className="mt-auto inline-flex items-center gap-2 self-start rounded-full border-2 border-(--bordure) px-3.5 py-2 text-[14px] font-bold text-(--titre) transition-[gap,background,color] duration-200 group-hover:gap-3.5 group-hover:bg-(--bordure) group-hover:text-white group-focus-visible:gap-3.5 group-focus-visible:bg-(--bordure) group-focus-visible:text-white">
                        {i18n.f(t.seeMeasures, { n: u.count })} <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
          <Photo
            className="mt-[clamp(40px,6vw,72px)] aspect-[21/9] overflow-hidden rounded-site"
            name="berlinBrandebourg"
            sizes="(max-width: 1248px) 100vw, 1200px"
            caption={t.photoCaption}
            position="50% 22%"
          />
        </div>
      </section>

      {/* SOUTIEN */}
      <section className="section overflow-hidden bg-lavande" ref={soutien}>
        <div className="site-container grid grid-cols-[1.2fr_1fr] items-center gap-12 max-[900px]:grid-cols-1">
          <div>
            <p className="m-0 font-titre text-[clamp(28px,3.4vw,40px)] text-violet uppercase">{t.weAre}</p>
            {/* Chiffres à chasse fixe : le nombre ne « danse » pas pendant qu'il défile */}
            <p
              className="mt-1 mb-2 font-titre text-[clamp(64px,11vw,140px)] leading-none text-violet tabular-nums"
              aria-live="polite"
            >
              <span className="inline-block bg-[linear-gradient(transparent_58%,var(--color-jaune)_58%)] px-[0.12em]">
                {supporters !== null ? i18n.number(displayCount) : t.manyThousands}
              </span>
            </p>
            <p className="m-0 mb-2.5 font-titre text-[clamp(24px,3vw,34px)] leading-[1.1] text-rouge uppercase">
              {t.supportLead}
            </p>
            <p className="muted">{t.supportText}</p>
            <div className="btn-row mt-6">
              <a href={c.links.soutenir} target="_blank" rel="noopener" className="btn btn-rouge">
                {t.supportBtn}
              </a>
            </div>
          </div>
          <Photo
            className="aspect-[4/5] overflow-hidden rounded-site shadow-[14px_14px_0_var(--color-violet)] max-[900px]:aspect-[4/3] max-[900px]:max-w-[520px]"
            name="melenchon"
            sizes="(max-width: 900px) 100vw, 480px"
            position="50% 30%"
          />
        </div>
      </section>

      {/* AGENDA */}
      {events.length > 0 && (
        <section className="section bg-gris-clair">
          <div className="site-container">
            <div className="section-head flex max-w-none flex-wrap items-end justify-between gap-4">
              <div>
                <span className="eyebrow">{t.agenda}</span>
                <h2 className="m-0">{t.nextEvents}</h2>
              </div>
              <Link className="font-bold" to={{ pathname: '/blog', hash: 'agenda' }}>
                {t.allAgenda}
              </Link>
            </div>
            <div className="grid-3">
              {events.slice(0, 3).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
