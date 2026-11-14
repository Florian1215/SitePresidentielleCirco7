import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CircoMap } from '../components/CircoMap';
import type { MapLabels, MapPoint } from '../components/CircoMap';
import { Photo } from '../components/Photo';
import { SupporterForm } from '../components/SupporterForm';
import { STEP_ICONS } from '../data/step-icons';
import { api } from '../lib/api';
import { CAMPAIGN, daysUntil } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import type { PollingStation } from '../lib/models';
import { usePageTitle } from '../lib/title';
import './Voter.scss';

/** `at` : avancement du bulletin à partir duquel l'étape s'allume. */
const STEP_LINKS = [
  { icon: 'check' as const, url: CAMPAIGN.links.checkSituation, at: 0.02 },
  { icon: 'register' as const, url: CAMPAIGN.links.registerOnline, at: 0.5 },
  { icon: 'vote' as const, url: CAMPAIGN.links.procuration, at: 1 },
];

type StationPoint = MapPoint & { station: PollingStation };

/** Lien d'un bureau de vote : la page du consulat si elle est renseignée, sinon le plan OpenStreetMap. */
function stationHref(s: PollingStation) {
  return s.url || `https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=17/${s.latitude}/${s.longitude}`;
}

export default function Voter() {
  usePageTitle('voter');
  const i18n = useI18n();
  const t = i18n.d.voter;
  const l = CAMPAIGN.links;

  // ---------- Animation des 3 étapes ----------
  const track = useRef<HTMLDivElement>(null);
  /** Avancement du bulletin sur le rail, de 0 (départ) à 1 (dans l'urne). */
  const [progress, setProgress] = useState(0);
  const done = progress >= 1;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      return;
    }
    const el = track.current!;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const top = r.top + window.scrollY; // position du rail dans la page
      // Départ : quand le rail entre par le bas de l'écran (ou dès le haut de la page s'il est déjà visible).
      // Arrivée : quand le milieu des étapes passe vers le milieu de l'écran, après au moins 1/3 d'écran de défilement.
      const s0 = Math.max(0, top - vh * 0.9);
      const s1 = Math.max(s0 + vh / 3, top + r.height / 2 - vh * 0.5);
      const p = (window.scrollY - s0) / (s1 - s0);
      setProgress(Math.round(Math.min(1, Math.max(0, p)) * 1000) / 1000);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  /** Feuilles du calendrier « Les dates à retenir ». */
  const dates = useMemo(() => {
    const e = CAMPAIGN.election;
    const consulate = i18n.date(e.registrationDeadlineConsulate, { day: 'numeric', month: 'long' });
    const sheet = (iso: string, label: string, color: string, note = '') => ({
      label,
      note,
      color,
      day: new Date(iso + 'T12:00:00').getDate(),
      month: i18n.date(iso, { month: 'long' }),
      year: new Date(iso + 'T12:00:00').getFullYear(),
      weekday: i18n.date(iso, { weekday: 'long' }),
      daysLeft: daysUntil(iso),
    });
    return [
      sheet(e.registrationDeadlineOnline, t.deadline, 'rouge', i18n.f(t.deadlineNote, { date: consulate })),
      sheet(e.firstRound, t.firstRound, 'violet'),
      sheet(e.secondRound, t.secondRound, 'jaune'),
    ];
  }, [i18n, t]);

  const steps = t.steps.map((s, i) => ({ ...s, ...STEP_LINKS[i] }));

  // ---------- Bureaux de vote (admin Django → Bureaux de vote) ----------
  /** undefined = en cours de chargement. */
  const [stations, setStations] = useState<PollingStation[] | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.pollingStations().then(
      (s) => alive && setStations(s),
      () => alive && setStations([]),
    );
    return () => {
      alive = false;
    };
  }, []);
  const stationPoints = useMemo<StationPoint[]>(
    () => (stations ?? []).map((s) => ({ ...s, href: stationHref(s), station: s })),
    [stations],
  );
  const mapLabels: MapLabels = {
    mapAria: t.stationsMapAria,
    zoomIn: i18n.d.circo.zoomIn,
    zoomOut: i18n.d.circo.zoomOut,
    resetZoom: i18n.d.circo.resetZoom,
    legendCirco: i18n.d.circo.legendCirco,
    legendPoint: t.legendStation,
    registeredN: i18n.d.circo.registeredN,
    pointOne: t.stationOne,
    pointMany: t.stationMany,
    listAria: t.stationsListAria,
    listEmpty: t.stationsPending,
    pointAria: t.stationOpen,
  };

  return (
    <div className="page-voter">
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-text">
            <span className="eyebrow">{t.eyebrow}</span>
            <h1>
              {t.titleA}
              <br />
              <span className="hl-rouge">{t.titleB}</span>
            </h1>
            <p className="lead">
              {t.leadA} <span className="hl">{t.leadHl}</span>
              {t.leadB}
            </p>
            <div className="btn-row">
              <a href={l.checkSituation} target="_blank" rel="noopener" className="btn">
                {t.checkBtn}
              </a>
              <a href={l.registerOnline} target="_blank" rel="noopener" className="btn btn-rouge">
                {t.registerBtn}
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <Photo className="hero-photo" name="voteAsma" sizes="(max-width: 900px) 80vw, 380px" position="50% 30%" eager />
          </div>
        </div>
      </section>

      {/* ÉTAPES : un bulletin avance sur le rail au fil du défilement, puis tombe dans l'urne */}
      <section className="section steps-section">
        <div className="container">
          <h2 className="steps-title">{t.stepsTitle}</h2>
          <div className={`track${done ? ' done' : ''}`} ref={track} style={{ '--p': progress } as CSSProperties}>
            <div className="rail" aria-hidden="true">
              <span className="rail-fill"></span>
            </div>
            <span className="ballot" aria-hidden="true"></span>
            <ol className="stations">
              {steps.map((s, i) => {
                const icon = STEP_ICONS[s.icon];
                return (
                  <li key={s.icon} className={`station station-${i + 1}${progress >= s.at ? ' on' : ''}`}>
                    <span className="station-icon">
                      <svg viewBox={icon.viewBox} aria-hidden="true" focusable="false">
                        <path d={icon.d} />
                      </svg>
                      <span className="station-num" aria-hidden="true">
                        {i + 1}
                      </span>
                    </span>
                    <h3>{s.title}</h3>
                    <a href={s.url} target="_blank" rel="noopener" className="btn btn-sm">
                      {s.cta}
                    </a>
                  </li>
                );
              })}
            </ol>
            <span className="stamp" aria-hidden="true">
              {t.stamp}
            </span>
          </div>
        </div>
      </section>

      {/* CALENDRIER */}
      <section className="section bg-violet">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">{t.calEyebrow}</span>
            <h2>{t.calTitle}</h2>
          </div>
          <ul className="calendar">
            {dates.map((d) => (
              <li key={d.color} className={`sheet sheet-${d.color}`}>
                <span className="sheet-rings" aria-hidden="true"></span>
                <span className="sheet-month">
                  {d.month} {d.year}
                </span>
                <span className="sheet-day">{d.day}</span>
                <span className="sheet-weekday">{d.weekday}</span>
                <span className="sheet-label">{d.label}</span>
                {d.note && <span className="sheet-note">{d.note}</span>}
                <span className="sheet-count">{d.daysLeft > 0 ? i18n.f(t.inDays, { n: d.daysLeft }) : t.today}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* OÙ VOTER : carte des bureaux de vote */}
      <section className="section stations-section" id="bureaux-de-vote">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t.stationsEyebrow}</span>
            <h2>{t.stationsTitle}</h2>
            <p className="lead">{t.stationsLead}</p>
          </div>
        </div>

        <CircoMap
          idPrefix="bureaux"
          points={stationPoints}
          labels={mapLabels}
          renderTooltip={(p) => (
            <>
              <strong>{p.name}</strong>
              {p.station.address && <span>{p.station.address}</span>}
              <span>
                {p.station.city} · {i18n.country(p.country)}
              </span>
              {p.station.info && <span>{p.station.info}</span>}
              <em>{t.stationClick}</em>
            </>
          )}
          renderItem={(p) => (
            <>
              {p.name}
              <span className="point-sub">{p.station.address || p.station.city}</span>
            </>
          )}
          panelFooter={
            <>
              <p>
                <strong>{t.myStationQ}</strong> {t.myStationText}
              </p>
              <a href={l.checkSituation} target="_blank" rel="noopener" className="btn btn-rouge btn-sm">
                {t.myStationBtn}
              </a>
            </>
          }
        />
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container container-narrow">
          <div className="section-head">
            <span className="eyebrow">{t.faqEyebrow}</span>
            <h2>{t.faqTitle}</h2>
          </div>
          <div className="faq">
            {t.faq.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
          <p className="sources muted">
            {t.sources}{' '}
            <a href={l.diplomatieElections} target="_blank" rel="noopener">
              {t.sourceDiplo}
            </a>{' '}
            ·{' '}
            <a href={l.servicePublicElections} target="_blank" rel="noopener">
              {t.sourceSP}
            </a>
          </p>
        </div>
      </section>

      {/* AIDE */}
      <section className="section bg-lavande">
        <div className="container help-grid">
          <div>
            <span className="eyebrow">{t.helpEyebrow}</span>
            <h2>{t.helpTitle}</h2>
            <p className="lead">{t.helpLead}</p>
            <Photo className="help-photo" name="standLfi" sizes="(max-width: 900px) 100vw, 460px" position="60% 50%" />
          </div>
          <div className="card">
            <SupporterForm helpPreset submitLabel={t.helpSubmit} />
          </div>
        </div>
      </section>
    </div>
  );
}
