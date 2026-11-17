import { useEffect, useMemo, useState } from 'react';
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

/** Lien, pictogramme et couleur de chaque étape : --c (picto, numéro, bouton) et --c-fond (fond de la carte et du picto). */
const STEP_STYLES = [
  { url: CAMPAIGN.links.checkSituation, icon: 'check', color: '[--c-fond:var(--color-lavande)] [--c:var(--color-violet)]' },
  { url: CAMPAIGN.links.registerOnline, icon: 'register', color: '[--c-fond:var(--color-rose)] [--c:var(--color-rouge)]' },
  { url: CAMPAIGN.links.procuration, icon: 'vote', color: '[--c-fond:#d9f2e3] [--c:var(--color-vert)]' },
] as const;

type StationPoint = MapPoint & { station: PollingStation };

/** Lien d'un bureau de vote : la page du consulat si elle est renseignée, sinon le plan OpenStreetMap. */
function stationHref(s: PollingStation) {
  return s.url || `https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=17/${s.latitude}/${s.longitude}`;
}

/** Anneaux de reliure de la feuille de calendrier. */
const SHEET_RINGS =
  "absolute -top-2.5 right-0 left-0 flex justify-center gap-[90px] before:h-[26px] before:w-3 before:rounded-md before:bg-noir before:shadow-[inset_0_-4px_0_rgba(255,255,255,0.25)] before:content-[''] after:h-[26px] after:w-3 after:rounded-md after:bg-noir after:shadow-[inset_0_-4px_0_rgba(255,255,255,0.25)] after:content-['']";

export default function Voter() {
  usePageTitle('voter');
  const i18n = useI18n();
  const t = i18n.d.voter;
  const l = CAMPAIGN.links;

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

  const deadline = i18n.date(CAMPAIGN.election.registrationDeadlineOnline, { day: 'numeric', month: 'long' });
  const steps = t.steps.map((s, i) => ({ ...s, text: i18n.f(s.text, { date: deadline }), ...STEP_STYLES[i] }));

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

      {/* ÉTAPES */}
      <section className="section bg-white">
        <div className="site-container">
          <h2 className="mb-[clamp(32px,5vw,56px)] text-center">{t.stepsTitle}</h2>
          <ol className="mx-auto my-0 grid max-w-[1000px] list-none grid-cols-3 gap-6 p-0 max-[900px]:grid-cols-1">
            {steps.map((s, i) => {
              const icon = STEP_ICONS[s.icon];
              return (
                <li
                  key={s.url}
                  className={`group flex flex-col rounded-site border-t-6 border-(--c) bg-(--c-fond) p-6 transition-[translate,rotate] duration-250 ease-bounce hover:-translate-y-1.5 motion-reduce:hover:translate-y-0 ${['hover:-rotate-1', 'hover:rotate-1', 'hover:-rotate-1'][i]} motion-reduce:hover:rotate-0 ${s.color}`}
                >
                  <span className="relative grid h-[72px] w-[72px] place-items-center rounded-full bg-white shadow-site transition-[rotate,scale] duration-300 ease-bounce group-hover:scale-110 group-hover:-rotate-12 motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0">
                    <svg className="h-8 w-8 fill-(--c)" viewBox={icon.viewBox} aria-hidden="true" focusable="false">
                      <path d={icon.d} />
                    </svg>
                    <span
                      className="absolute -top-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-(--c) font-titre text-[16px] text-white"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-4 mb-2 text-[clamp(20px,2.2vw,24px)] text-(--c)">{s.title}</h3>
                  <p className="mb-5 text-noir">{s.text}</p>
                  <a href={s.url} target="_blank" rel="noopener" className="btn btn-sm mt-auto self-start bg-(--c)">
                    {s.cta}
                  </a>
                </li>
              );
            })}
          </ol>
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
      <section className="bg-gris-clair max-[960px]:pt-8" id="bureaux-de-vote">
        <CircoMap
          idPrefix="bureaux"
          title={
            <>
              <span className="eyebrow">{t.stationsEyebrow}</span>
              <h2 className="m-0 text-[clamp(26px,3vw,40px)]">{t.stationsTitle}</h2>
            </>
          }
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
