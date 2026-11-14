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

/** Couleur de chaque étape : --c (picto, titre, bouton) et --c-fond (fond du picto). */
const STATION_COLORS = [
  '[--c-fond:var(--color-lavande)] [--c:var(--color-violet)]',
  '[--c-fond:var(--color-rose)] [--c:var(--color-rouge)]',
  '[--c-fond:#d9f2e3] [--c:var(--color-vert)]',
];

/** Le bulletin : une enveloppe de vote (le rabat est dessiné par ::before), qui avance sur le rail. */
const BALLOT =
  "absolute z-3 -mt-4 -ml-[23px] h-8 w-[46px] rounded border-2 border-violet bg-white shadow-[0_6px_14px_rgba(33,35,32,0.18)] before:absolute before:inset-0 before:[clip-path:polygon(0_0,100%_0,50%_60%)] before:content-[''] before:[background:linear-gradient(to_bottom_right,transparent_49%,var(--color-violet)_49%_53%,transparent_53%)_left/50%_100%_no-repeat,linear-gradient(to_bottom_left,transparent_49%,var(--color-violet)_49%_53%,transparent_53%)_right/50%_100%_no-repeat] max-[900px]:left-[46px] motion-reduce:transition-none";
/** En route : il suit le défilement (sans transition sur la position, sinon il serait en retard). */
const BALLOT_MOVING =
  'top-[46px] left-[calc(16.66%_+_var(--p)_*_66.68%)] rotate-[calc(-8deg_+_var(--p)_*_16deg)] transition-[rotate] duration-200 max-[900px]:top-[calc(46px_+_var(--p)_*_(100%_-_92px))]';
/** Arrivé au bout : il tombe dans l'urne. */
const BALLOT_DONE =
  'top-[70px] left-[83.34%] scale-60 rotate-0 opacity-0 [transition:top_0.5s_cubic-bezier(0.55,0,1,0.45),opacity_0.3s_0.35s,rotate_0.4s,scale_0.4s] max-[900px]:top-[calc(100%_-_22px)]';

/** Anneaux de reliure de la feuille de calendrier. */
const SHEET_RINGS =
  "absolute -top-2.5 right-0 left-0 flex justify-center gap-[90px] before:h-[26px] before:w-3 before:rounded-md before:bg-noir before:shadow-[inset_0_-4px_0_rgba(255,255,255,0.25)] before:content-[''] after:h-[26px] after:w-3 after:rounded-md after:bg-noir after:shadow-[inset_0_-4px_0_rgba(255,255,255,0.25)] after:content-['']";

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
    /** color : classes du bandeau du mois (fond et texte). */
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
      sheet(e.registrationDeadlineOnline, t.deadline, 'bg-rouge text-creme', i18n.f(t.deadlineNote, { date: consulate })),
      sheet(e.firstRound, t.firstRound, 'bg-violet-vif text-creme'),
      sheet(e.secondRound, t.secondRound, 'bg-jaune text-noir'),
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
    <div>
      {/* HERO */}
      <section className="overflow-hidden pt-[clamp(40px,7vw,88px)] pb-[clamp(56px,8vw,104px)]">
        <div className="site-container grid grid-cols-[1.4fr_1fr] items-center gap-12 max-[900px]:grid-cols-1">
          <div>
            <span className="eyebrow">{t.eyebrow}</span>
            <h1>
              {t.titleA}
              <br />
              <span className="hl-rouge">{t.titleB}</span>
            </h1>
            <p className="lead mt-2 mb-8 max-w-[580px]">
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

          <div className="relative w-full max-w-[380px] justify-self-center max-[900px]:mt-4 max-[900px]:max-w-[300px]">
            <Photo
              className="aspect-[3/4] overflow-hidden rounded-site"
              name="voteAsma"
              sizes="(max-width: 900px) 80vw, 380px"
              position="50% 30%"
              eager
            />
          </div>
        </div>
      </section>

      {/* ÉTAPES : un bulletin avance sur le rail au fil du défilement, puis tombe dans l'urne */}
      <section className="section bg-white">
        <div className="site-container">
          <h2 className="mb-[clamp(40px,6vw,72px)] text-center">{t.stepsTitle}</h2>
          {/* --p : avancement du bulletin (0 → 1), mis à jour au défilement */}
          <div className="relative mx-auto max-w-[1000px]" ref={track} style={{ '--p': progress } as CSSProperties}>
            {/* Rail : de la 1re à la 3e étape (centres des colonnes : 1/6 et 5/6 de la largeur) ; vertical sur mobile */}
            <div
              className="absolute top-[46px] right-[16.66%] left-[16.66%] h-1.5 rounded-[3px] bg-[repeating-linear-gradient(90deg,var(--color-gris)_0_14px,transparent_14px_22px)] max-[900px]:right-auto max-[900px]:bottom-[46px] max-[900px]:left-[46px] max-[900px]:h-auto max-[900px]:w-1.5 max-[900px]:bg-[repeating-linear-gradient(180deg,var(--color-gris)_0_14px,transparent_14px_22px)]"
              aria-hidden="true"
            >
              <span className="absolute inset-0 origin-left scale-x-(--p) rounded-[3px] bg-[linear-gradient(90deg,var(--color-violet),var(--color-rouge),var(--color-vert))] max-[900px]:origin-top max-[900px]:scale-x-100 max-[900px]:scale-y-(--p) max-[900px]:bg-[linear-gradient(180deg,var(--color-violet),var(--color-rouge),var(--color-vert))]"></span>
            </div>
            <span className={`${BALLOT} ${done ? BALLOT_DONE : BALLOT_MOVING}`} aria-hidden="true"></span>
            <ol className="m-0 grid list-none grid-cols-3 gap-6 p-0 max-[900px]:grid-cols-1 max-[900px]:gap-12">
              {steps.map((s, i) => {
                const icon = STEP_ICONS[s.icon];
                // Étape atteinte par le bulletin : elle prend sa couleur et « saute »
                const on = progress >= s.at;
                return (
                  <li
                    key={s.icon}
                    className={`flex flex-col items-center text-center max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:gap-x-[18px] max-[900px]:text-left ${STATION_COLORS[i]}`}
                  >
                    <span
                      className={`relative z-2 grid h-[92px] w-[92px] place-items-center rounded-full border-3 [transition:background_0.3s,border-color_0.3s,scale_0.4s_var(--ease-bounce)] motion-reduce:animate-none motion-reduce:transition-none ${on ? 'animate-station-hop scale-[1.08] border-solid border-(--c) bg-(--c-fond)' : 'border-dashed border-gris-moyen bg-white'}`}
                    >
                      <svg
                        className={`h-[38px] w-[38px] transition-[fill] duration-300 ${on ? 'fill-(--c)' : 'fill-gris-moyen'}`}
                        viewBox={icon.viewBox}
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d={icon.d} />
                      </svg>
                      <span
                        className={`absolute -top-1.5 -right-1.5 grid h-[30px] w-[30px] place-items-center rounded-full font-titre text-[17px] text-white transition-colors duration-300 ${on ? 'bg-(--c)' : 'bg-gris-moyen'}`}
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                    </span>
                    <h3
                      className={`mt-4 mb-3.5 text-[clamp(22px,2.4vw,28px)] transition-colors duration-300 max-[900px]:m-0 max-[900px]:flex-1 ${on ? 'text-(--c)' : 'text-gris-moyen'}`}
                    >
                      {s.title}
                    </h3>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener"
                      className={`btn btn-sm [transition:background_0.3s,transform_0.15s] max-[900px]:ml-[110px] ${on ? 'bg-(--c)' : 'bg-gris-moyen'}`}
                    >
                      {s.cta}
                    </a>
                  </li>
                );
              })}
            </ol>
            {/* Tampon « A voté ! » quand le bulletin est dans l'urne */}
            <span
              className={`absolute -top-[18px] left-[calc(83.33%+34px)] z-4 -rotate-12 rounded-md border-3 border-rouge bg-[rgba(255,255,255,0.9)] px-3 py-1 font-titre text-[24px] whitespace-nowrap text-rouge uppercase [transition:opacity_0.2s_0.4s,scale_0.35s_var(--ease-bounce)_0.4s] max-[900px]:top-auto max-[900px]:bottom-16 max-[900px]:left-[130px] motion-reduce:transition-none ${done ? 'scale-100 opacity-100' : 'scale-[2.2] opacity-0'}`}
              aria-hidden="true"
            >
              {t.stamp}
            </span>
          </div>
        </div>
      </section>

      {/* CALENDRIER */}
      <section className="section section-violet">
        <div className="site-container">
          <div className="section-head mx-auto text-center">
            <span className="eyebrow">{t.calEyebrow}</span>
            <h2>{t.calTitle}</h2>
          </div>
          <ul className="mx-auto my-0 grid list-none grid-cols-[repeat(3,minmax(0,260px))] justify-center gap-7 p-0 max-[900px]:grid-cols-[minmax(0,300px)] max-[900px]:gap-10">
            {dates.map((d, i) => (
              <li
                key={d.color}
                className={`relative flex flex-col items-center rounded-[14px] bg-white px-4 pb-5 text-center text-noir shadow-[0_14px_0_-6px_rgba(255,252,244,0.35),0_18px_30px_rgba(0,0,0,0.25)] transition-[translate,rotate] duration-200 hover:-translate-y-1 hover:rotate-0 motion-reduce:hover:translate-y-0 ${['-rotate-2', '', 'rotate-2'][i]}`}
              >
                {/* Anneaux de reliure */}
                <span className={SHEET_RINGS} aria-hidden="true"></span>
                <span
                  className={`-mx-4 self-stretch rounded-t-[14px] px-3 pt-[22px] pb-2.5 font-titre text-[22px] tracking-[0.04em] uppercase ${d.color}`}
                >
                  {d.month} {d.year}
                </span>
                <span className="mt-3.5 font-titre text-[104px] leading-none text-noir">{d.day}</span>
                <span className="font-bold text-texte capitalize">{d.weekday}</span>
                <span className="mt-3.5 self-stretch border-t-2 border-gris [border-top-style:dashed] pt-3.5 font-titre text-[24px] text-violet uppercase">
                  {d.label}
                </span>
                {d.note && <span className="mt-1 mb-3.5 text-[13px] text-texte">{d.note}</span>}
                <span
                  className={`translate-y-1.5 rounded-full bg-lavande px-3 py-1 text-[13px] font-bold text-violet ${d.note ? 'mt-auto' : 'mt-3.5'}`}
                >
                  {d.daysLeft > 0 ? i18n.f(t.inDays, { n: d.daysLeft }) : t.today}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* OÙ VOTER : carte des bureaux de vote */}
      <section className="section bg-gris-clair pb-0" id="bureaux-de-vote">
        <div className="site-container">
          <div className="section-head mb-6">
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
              <span className="block text-[13px] whitespace-pre-line text-texte">{p.station.address || p.station.city}</span>
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
        <div className="site-container max-w-[820px]">
          <div className="section-head">
            <span className="eyebrow">{t.faqEyebrow}</span>
            <h2>{t.faqTitle}</h2>
          </div>
          <div className="grid gap-3">
            {t.faq.map((item) => (
              <details key={item.q} className="rounded-site border border-gris bg-white px-[22px] open:border-violet">
                <summary className="cursor-pointer list-outside py-[18px] text-[17px] font-bold text-violet">{item.q}</summary>
                <p className="pb-1.5 text-texte">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="muted mt-6 text-[14px]">
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
        <div className="site-container grid grid-cols-[1fr_1.3fr] items-start gap-10 max-[900px]:grid-cols-1">
          <div>
            <span className="eyebrow">{t.helpEyebrow}</span>
            <h2>{t.helpTitle}</h2>
            <p className="lead">{t.helpLead}</p>
            <Photo
              className="mt-8 aspect-[4/3] overflow-hidden rounded-site max-[900px]:hidden"
              name="standLfi"
              sizes="(max-width: 900px) 100vw, 460px"
              position="60% 50%"
            />
          </div>
          <div className="card">
            <SupporterForm helpPreset submitLabel={t.helpSubmit} />
          </div>
        </div>
      </section>
    </div>
  );
}
