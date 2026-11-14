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
import './Home.scss';

/** Affiches du haut de page : chacune ouvre la partie correspondante du programme. */
const POSTER_SLUGS = ['securite-sociale', 'futur', 'ecologie', 'monde'];

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
    <div className="page-home">
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-text">
            <span className="eyebrow">{i18n.f(t.eyebrow, { circo: i18n.d.common.circo })}</span>
            <h1>
              {t.titleA} <span className="hl-violet">{t.titleHl}</span> {t.titleB}
            </h1>
            <p className="lead">
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

          <nav className="hero-visual" aria-label={t.postersAria}>
            {posters.map((p, i) => (
              <Link
                key={p.slug + p.top}
                className={`poster poster-${i + 1}`}
                to={{ pathname: '/programme', hash: p.slug }}
                aria-label={i18n.f(t.posterAria, { title: p.top + ' ' + p.bottom })}
              >
                <span>{p.top}</span>
                <strong>{p.bottom}</strong>
                <em className="poster-cta" aria-hidden="true">
                  {t.posterCta}
                </em>
              </Link>
            ))}
            <span className="sticker hero-sticker" aria-hidden="true">
              {i18n.f(t.sticker, { n: COUNTRIES.length })}
            </span>
          </nav>
        </div>
      </section>

      {/* DATES CLÉS */}
      <section className="dates bg-violet">
        <div className="container dates-grid">
          {keyDates.map((d) => (
            <div className="date-item" key={d.label}>
              <span className="date-cal" aria-hidden="true">
                <span className="date-day">{d.day}</span>
                <span className="date-month">{d.month}</span>
              </span>
              <span className="date-label">
                {d.label}
                <br />
                <small>
                  {d.weekday} · <strong>{i18n.f(t.daysLeft, { n: d.daysLeft })}</strong>
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
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t.programmeEyebrow}</span>
            <h2>{t.urgencesTitle}</h2>
          </div>
          <ol className="urgences">
            {urgences.map((u) => {
              const icon = CATEGORY_ICONS[u.cat.icon];
              return (
                <li key={u.slug}>
                  <Link className={`urgence cat-${u.cat.color}`} to={{ pathname: '/programme', hash: u.slug }}>
                    <div className="urgence-head">
                      <span className="urgence-icon">
                        <svg viewBox={icon.viewBox} aria-hidden="true" focusable="false">
                          <path d={icon.d} />
                        </svg>
                      </span>
                      <h3>{u.title}</h3>
                    </div>
                    <div className="urgence-body">
                      <p>{u.text}</p>
                      <ul className="urgence-keys">
                        {u.keys.map((m) => (
                          <li key={m.title}>{m.title}</li>
                        ))}
                      </ul>
                      <span className="urgence-cta">
                        {i18n.f(t.seeMeasures, { n: u.count })} <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
          <Photo
            className="home-photo"
            name="berlinBrandebourg"
            sizes="(max-width: 1248px) 100vw, 1200px"
            caption={t.photoCaption}
            position="50% 22%"
          />
        </div>
      </section>

      {/* SOUTIEN */}
      <section className="section soutien" ref={soutien}>
        <div className="container soutien-grid">
          <div className="soutien-text">
            <p className="soutien-kicker">{t.weAre}</p>
            <p className="soutien-count" aria-live="polite">
              <span className="hl-count">{supporters !== null ? i18n.number(displayCount) : t.manyThousands}</span>
            </p>
            <p className="soutien-lead">{t.supportLead}</p>
            <p className="muted">{t.supportText}</p>
            <div className="btn-row">
              <a href={c.links.soutenir} target="_blank" rel="noopener" className="btn btn-rouge">
                {t.supportBtn}
              </a>
            </div>
          </div>
          <Photo className="soutien-photo" name="melenchon" sizes="(max-width: 900px) 100vw, 480px" position="50% 30%" />
        </div>
      </section>

      {/* AGENDA */}
      {events.length > 0 && (
        <section className="section bg-gris">
          <div className="container">
            <div className="section-head row-head">
              <div>
                <span className="eyebrow">{t.agenda}</span>
                <h2>{t.nextEvents}</h2>
              </div>
              <Link to={{ pathname: '/blog', hash: 'agenda' }}>{t.allAgenda}</Link>
            </div>
            <div className="grid grid-3">
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
