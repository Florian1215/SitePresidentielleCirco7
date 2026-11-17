import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  DATA_URL,
  FR_RATE,
  LEVEL_COMMENT,
  LEVEL_HIGH,
  LEVEL_LABEL,
  LEVEL_LOW,
  NAME_OVERRIDES,
  SOURCE_SITE,
  STEPS,
  THRESHOLD,
  UNRATED_COMMENT,
  answerOf,
  evaluate,
  fmtRate,
  fmtRateD,
  levelOf,
  normalize,
} from '../data/impot-universel.data';
import type { Answer, CountryData, Level, RowState } from '../data/impot-universel.data';
import { COUNTRIES as CIRCO_COUNTRIES } from '../lib/campaign';
import { usePageTitle } from '../lib/title';

type Screen = { kind: 'start' } | { kind: 'step'; i: number } | { kind: 'result' };

const KEYS = ['A', 'B', 'C'];
/** Échelle de la jauge des taux (0 → 50 %). */
const GAUGE_MAX = 50;
const STATE_LABELS: Record<RowState, string> = {
  met: 'Remplie',
  unmet: 'Non remplie',
  unknown: 'À vérifier',
  skipped: 'Non évaluée',
};

/** Couleurs des niveaux (vert = concerné·e, jaune = cas limite, rouge = pas concerné·e) : couleur pleine, fond clair, texte. */
const LVL: Record<Level, { bar: string; border: string; bg: string; light: string }> = {
  below: { bar: 'bg-vert', border: 'border-vert', bg: 'bg-[#edfbf3]', light: 'bg-[#edfbf3] text-[#186842]' },
  debatable: { bar: 'bg-jaune', border: 'border-jaune', bg: 'bg-[#fffbe6]', light: 'bg-[#fffbe6] text-[#6b5100]' },
  above: { bar: 'bg-rouge', border: 'border-rouge', bg: 'bg-[#fdecea]', light: 'bg-[#fdecea] text-[#8f120a]' },
};
const STATE_STYLES: Record<RowState, string> = {
  met: LVL.below.light,
  unmet: LVL.above.light,
  unknown: LVL.debatable.light,
  skipped: 'bg-gris-clair text-gris-moyen',
};
const VERDICT_STYLES: Record<string, string> = {
  yes: 'bg-vert text-white',
  maybe: 'bg-jaune text-noir',
  no: 'bg-rouge text-creme',
};

/** Libellé d'un repère de la jauge (seuil, France, pays). */
const GAUGE_LABEL =
  'absolute text-[12px] font-bold whitespace-nowrap not-italic [font-variation-settings:normal] max-[720px]:text-[11px]';
/** Repère vertical de la jauge (seuil, France). */
const GAUGE_MARK = 'absolute -top-1.5 -bottom-1.5 w-0.5 -translate-x-px';

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' });
  } catch {
    return null;
  }
})();

function countryName(code: string): string {
  return NAME_OVERRIDES[code] ?? regionNames?.of(code) ?? code;
}

/** Pays proposés au questionnaire : uniquement ceux de la 7e circonscription (Kosovo compris, même sans données). */
const COUNTRIES = CIRCO_COUNTRIES.filter((c) => c.code !== 'XX')
  .map((c) => ({ code: c.code, name: countryName(c.code) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

function pos(rate: number): number {
  return Math.min(100, Math.max(0, (rate / GAUGE_MAX) * 100));
}

const pct = (n: number) => `${n}%`;

/** Jauge : seuil, bornes de prudence, France et pays. */
function Gauge({ d, name }: { d: CountryData; name: string }) {
  return (
    <div
      className="mt-10 mb-5"
      role="img"
      aria-label={`${name} : ${fmtRate(d.rate)}, seuil ${fmtRate(THRESHOLD)}, France ${fmtRate(FR_RATE)}`}
    >
      <div className="relative h-3.5 rounded-full bg-gris">
        <span
          className="absolute top-0 bottom-0 left-0 rounded-l-full bg-vert opacity-35"
          style={{ width: pct(pos(LEVEL_LOW)) }}
        ></span>
        <span
          className="absolute top-0 bottom-0 bg-jaune opacity-35"
          style={{ left: pct(pos(LEVEL_LOW)), width: pct(pos(LEVEL_HIGH) - pos(LEVEL_LOW)) }}
        ></span>
        <span
          className="absolute top-0 bottom-0 rounded-r-full bg-rouge opacity-35"
          style={{ left: pct(pos(LEVEL_HIGH)), right: '0%' }}
        ></span>
        {d.range && (
          <span
            className="absolute top-[3px] bottom-[3px] rounded-full bg-violet opacity-45"
            style={{ left: pct(pos(d.range[0])), width: pct(pos(d.range[1]) - pos(d.range[0])) }}
          ></span>
        )}
        <span className={`${GAUGE_MARK} bg-noir`} style={{ left: pct(pos(THRESHOLD)) }}>
          <em className={`${GAUGE_LABEL} top-full left-1/2 mt-1 -translate-x-1/2 text-texte`}>Seuil {fmtRate(THRESHOLD)}</em>
        </span>
        <span className={`${GAUGE_MARK} bg-violet`} style={{ left: pct(pos(FR_RATE)) }}>
          <em className={`${GAUGE_LABEL} top-full left-1/2 mt-1 -translate-x-1/2 text-violet`}>France {fmtRate(FR_RATE)}</em>
        </span>
        <span
          className="absolute -top-0.5 h-[18px] w-[18px] -translate-x-[9px] rounded-full border-3 border-white bg-rouge shadow-[0_1px_4px_rgba(33,35,32,0.35)]"
          style={{ left: pct(pos(d.rate)) }}
        >
          {/* Près des bords, le libellé s'aligne sur le point plutôt que de déborder */}
          <em
            className={`${GAUGE_LABEL} bottom-full mb-1.5 rounded bg-rouge px-2 py-0.5 text-creme ${pos(d.rate) < 15 ? '-left-1' : pos(d.rate) > 85 ? '-right-1' : 'left-1/2 -translate-x-1/2'}`}
          >
            {name} {fmtRate(d.rate)}
          </em>
        </span>
      </div>
      <div className="mt-[30px] flex justify-between text-[12px] text-gris-moyen" aria-hidden="true">
        <span>0 %</span>
        <span>25 %</span>
        <span>50 %</span>
      </div>
    </div>
  );
}

/**
 * Page « Impôt universel : suis-je concerné·e ? » (/impot-universel), liée depuis le bas de la page Programme.
 * Le questionnaire ne propose que les pays de la 7e circonscription.
 */
export default function ImpotUniversel() {
  usePageTitle('Impôt universel : suis-je concerné·e ? — LFI 7e circonscription');
  const card = useRef<HTMLDivElement>(null);

  // ---------- Données ----------
  const [data, setData] = useState<Record<string, CountryData> | null>(null);
  const [dataError, setDataError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(DATA_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(
        (d: Record<string, CountryData>) => alive && setData(d),
        () => alive && setDataError(true),
      );
    // Page pas encore ouverte au public : on demande aux moteurs de ne pas l'indexer.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      alive = false;
      meta.remove();
    };
  }, []);

  // ---------- Questionnaire ----------
  const [screen, setScreen] = useState<Screen>({ kind: 'start' });
  const [answers, setAnswers] = useState<Answer[]>([]);
  /** Pays choisi à la dernière question. */
  const [country, setCountry] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  /** Incrémenté à chaque changement d'écran : déclenche le focus et le défilement. */
  const [moves, setMoves] = useState(0);

  const progress = (() => {
    const done = screen.kind === 'start' ? 0 : screen.kind === 'step' ? screen.i : STEPS.length;
    return Math.round((100 * done) / STEPS.length);
  })();

  const result = useMemo(() => evaluate(answers), [answers]);

  const verdict = (() => {
    const d = country ? data?.[country] : undefined;
    if (result.verdict === 'no') {
      let reason = result.reason ?? '';
      if (answers[4] === 'no' && country && d) {
        reason = `pays de résidence choisi : ${countryName(country)}. Son taux effectif d'impôt sur le revenu, estimé à ${fmtRate(d.rate)}, dépasse le seuil de ${fmtRate(THRESHOLD)}.`;
      }
      return {
        cls: 'no',
        badge: 'Non concerné·e',
        title: 'Vous ne seriez pas concerné·e.',
        body: `Raison : ${reason} Il faut remplir toutes les conditions à la fois.`,
      };
    }
    if (result.verdict === 'maybe') {
      return {
        cls: 'maybe',
        badge: 'À vérifier',
        title: 'Une seule condition reste à vérifier.',
        body: "Vous remplissez les quatre premières conditions. Reste à savoir si la fiscalité de votre pays de résidence est inférieure de plus de 40 % à celle de la France. Si c'est le cas, la mesure prévoit que vous acquittiez en France l'impôt français moins l'impôt déjà payé à l'étranger (crédit d'impôt), sous réserve des conventions fiscales signées par la France.",
      };
    }
    return {
      cls: 'yes',
      badge: 'Conditions remplies',
      title: 'Vous rempliriez toutes les conditions.',
      body: "D'après le texte proposé, vous auriez à acquitter en France l'impôt français moins l'impôt déjà payé dans votre pays de résidence (crédit d'impôt), sous réserve des conventions fiscales signées par la France.",
    };
  })();

  /** Encadré du pays choisi, affiché quand le questionnaire est allé jusqu'au bout. */
  const countryBox = (() => {
    if (!country || answers.length < STEPS.length) return null;
    const d = data?.[country];
    const level = levelOf(d);
    return {
      code: country,
      name: countryName(country),
      d,
      level,
      comment: d ? LEVEL_COMMENT[level] : UNRATED_COMMENT,
      unavailable: !d && dataError,
    };
  })();

  const go = (s: Screen) => {
    setScreen(s);
    setQuery('');
    setActive(-1);
    setMoves((m) => m + 1);
  };

  // Après le rendu : focus sur le titre de l'écran (ou le champ pays), et carte visible à l'écran.
  useEffect(() => {
    if (!moves) return;
    const el = card.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>('#country-input') ?? el.querySelector<HTMLElement>('h2');
    target?.focus({ preventScroll: true });
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.4) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [moves]);

  const start = () => {
    setAnswers([]);
    setCountry(null);
    go({ kind: 'step', i: 0 });
  };

  const restart = () => {
    setAnswers([]);
    setCountry(null);
    go({ kind: 'start' });
  };

  const back = (i: number) => {
    setAnswers((a) => a.slice(0, i - 1));
    go({ kind: 'step', i: i - 1 });
  };

  const choose = (i: number, value: Answer, code: string | null = null) => {
    const next = [...answers.slice(0, i), value];
    setAnswers(next);
    if (i === STEPS.length - 1) setCountry(code);
    const r = evaluate(next);
    go(r.verdict === 'incomplete' ? { kind: 'step', i: i + 1 } : { kind: 'result' });
  };

  // ---------- Sélecteur de pays ----------
  const shown = useMemo(() => {
    const q = normalize(query);
    return q ? COUNTRIES.filter((c) => normalize(c.name).includes(q)) : COUNTRIES;
  }, [query]);

  const pick = (code: string, i: number) => choose(i, answerOf(levelOf(data?.[code])), code);

  const scrollActive = () =>
    setTimeout(() => card.current?.querySelector('.picker-item.active')?.scrollIntoView({ block: 'nearest' }));

  const onPickerKey = (e: ReactKeyboardEvent, i: number) => {
    const n = shown.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (n) setActive((a) => Math.min(a + 1, n - 1));
      scrollActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) setActive((a) => Math.max(a - 1, 0));
      scrollActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (active >= 0) pick(shown[active].code, i);
      else if (n === 1) pick(shown[0].code, i);
    }
  };

  /** Raccourcis clavier : A/B/C pour répondre, Entrée pour commencer ou recommencer. */
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const el = card.current;
    // Les raccourcis ne valent que si le questionnaire est à l'écran.
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const onControl = t && (t.tagName === 'A' || t.tagName === 'BUTTON' || t.tagName === 'SUMMARY');
    if (e.key === 'Enter' && !onControl && screen.kind !== 'step') {
      e.preventDefault();
      if (screen.kind === 'start') start();
      else restart();
      return;
    }
    if (screen.kind !== 'step') return;
    const idx = KEYS.indexOf(e.key.toUpperCase());
    const opts = STEPS[screen.i].options;
    if (idx >= 0 && idx < opts.length) {
      e.preventDefault();
      choose(screen.i, opts[idx][1]);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const renderStep = (i: number) => {
    const step = STEPS[i];
    return (
      <div className="animate-iu-in motion-reduce:animate-none" data-step={i} key={'step-' + i}>
        <p className="mb-2 text-[14px] font-bold tracking-[0.08em] text-rouge uppercase">
          Question {i + 1} sur {STEPS.length}
        </p>
        <h2 tabIndex={-1}>{step.q}</h2>
        {step.help && <p className="-mt-1 text-texte">{step.help}</p>}

        {step.type === 'country' && (
          <div className="mt-5">
            <input
              type="text"
              id="country-input"
              placeholder="Tapez le nom d'un pays"
              autoComplete="off"
              role="combobox"
              aria-expanded="true"
              aria-controls="country-list"
              aria-label="Pays de résidence fiscale"
              aria-activedescendant={active >= 0 && shown[active] ? 'country-' + shown[active].code : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(-1);
              }}
              onKeyDown={(e) => onPickerKey(e, i)}
            />
            <ul
              className="mx-0 mt-2 mb-0 max-h-[260px] list-none overflow-y-auto rounded-site border border-gris bg-white p-1.5"
              id="country-list"
              role="listbox"
              aria-label="Pays"
            >
              {shown.length ? (
                shown.map((c, k) => (
                  <li
                    key={c.code}
                    role="option"
                    className={`cursor-pointer rounded-md px-3 py-2.5 hover:bg-lavande hover:font-bold hover:text-violet-dark ${k === active ? 'bg-lavande font-bold text-violet-dark' : ''}`}
                    id={'country-' + c.code}
                    aria-selected={k === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(c.code, i);
                    }}
                  >
                    {c.name}
                  </li>
                ))
              ) : (
                <li className="px-3 py-2.5 text-texte">Aucun pays trouvé. Utilisez « Je ne sais pas » ci-dessous.</li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-6 grid gap-3" role="group" aria-label="Réponses">
          {step.options.map((o, k) => (
            <button
              type="button"
              className="group flex w-full cursor-pointer items-center gap-4 rounded-site border-2 border-gris bg-creme px-[18px] py-4 text-left [font-family:inherit] text-[17px] leading-[inherit] font-medium text-noir transition-[border-color,background,translate] duration-150 hover:-translate-y-px hover:border-violet hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-jaune"
              key={o[1]}
              onClick={() => choose(i, o[1])}
            >
              <span
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md bg-lavande text-[14px] font-bold text-violet group-hover:bg-violet group-hover:text-creme"
                aria-hidden="true"
              >
                {KEYS[k]}
              </span>
              <span>{o[0]}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {i > 0 && (
            <button type="button" className="btn-link" onClick={() => back(i)}>
              ← Question précédente
            </button>
          )}
        </div>
      </div>
    );
  };

  const kbd = 'rounded border border-current px-1.5 py-0.5 text-[12px] font-medium tracking-normal normal-case opacity-75';

  return (
    <div>
      {/* EN-TÊTE */}
      <section className="page-hero border-b-0 pb-[clamp(24px,4vw,40px)] text-center">
        <div className="site-container max-w-[760px]">
          <span className="eyebrow">Impôt universel ciblé</span>
          <h1>
            Seriez-vous <span className="hl-rouge">concerné·e&nbsp;?</span>
          </h1>
          <p className="lead mx-auto">
            Ce n'est pas un impôt sur la nationalité : il vise l'évasion fiscale vers les pays où l'on paie beaucoup moins
            d'impôts qu'en France. Vérifiez votre situation en 5 questions.
          </p>
        </div>
      </section>

      {/* QUESTIONNAIRE */}
      <section className="section-sm pt-0">
        <div className="site-container max-w-[760px]">
          <div
            className="card relative scroll-mt-24 overflow-hidden border-t-6 border-violet p-[clamp(24px,5vw,48px)] pt-[calc(clamp(24px,5vw,48px)+6px)] [&_h2]:text-[clamp(28px,3.8vw,42px)] [&_h2:focus]:outline-none"
            ref={card}
            aria-live="polite"
          >
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gris" aria-hidden="true">
              <span
                className="block h-full bg-rouge transition-[width] duration-300 ease-[ease]"
                style={{ width: pct(progress) }}
              ></span>
            </div>

            {screen.kind === 'start' && (
              <div className="animate-iu-in motion-reduce:animate-none">
                <h2 tabIndex={-1}>Les 5 conditions</h2>
                <p className="text-[17px]">Il faut les remplir toutes à la fois.</p>
                <ol className="mx-0 mt-2 mb-7 grid list-none gap-2.5 p-0">
                  {STEPS.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3.5 font-medium">
                      <span className="num-badge h-[34px] w-[34px] bg-violet text-[18px]">{i + 1}</span>
                      {s.label}
                    </li>
                  ))}
                </ol>
                <button type="button" className="btn btn-rouge" onClick={start}>
                  Commencer{' '}
                  <span className={kbd} aria-hidden="true">
                    Entrée ↵
                  </span>
                </button>
              </div>
            )}

            {screen.kind === 'step' && renderStep(screen.i)}

            {screen.kind === 'result' && (
              <div className="animate-iu-in motion-reduce:animate-none">
                <span
                  className={`mb-4 inline-block -rotate-2 rounded-md px-4 py-1.5 font-titre text-[20px] uppercase ${VERDICT_STYLES[verdict.cls]}`}
                >
                  {verdict.badge}
                </span>
                <h2 tabIndex={-1}>{verdict.title}</h2>
                <p className="text-[17px] leading-[1.5]">{verdict.body}</p>

                <ul className="my-6 list-none border-t border-gris p-0" aria-label="Récapitulatif des conditions">
                  {result.rows.map((row, k) => (
                    <li
                      key={row.label}
                      className={`flex items-center justify-between gap-4 border-b border-gris py-3 ${row.state === 'skipped' ? 'text-gris-moyen' : ''}`}
                    >
                      <span>
                        {row.label}
                        {k === 4 && country && row.state !== 'skipped' && <> ({countryName(country)})</>}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold tracking-[0.06em] uppercase ${STATE_STYLES[row.state]}`}
                      >
                        {STATE_LABELS[row.state]}
                      </span>
                    </li>
                  ))}
                </ul>

                {countryBox && (
                  <div
                    className={`mb-7 rounded-site border-l-6 px-[22px] py-5 [&>p:last-child]:mb-0 ${LVL[countryBox.unavailable ? 'debatable' : countryBox.level].border} ${LVL[countryBox.unavailable ? 'debatable' : countryBox.level].bg}`}
                  >
                    {countryBox.unavailable ? (
                      <p className="text-[17px] font-bold">{countryBox.name} : données indisponibles pour le moment.</p>
                    ) : (
                      <>
                        <p className="text-[17px] font-bold">
                          {countryBox.name} : {LEVEL_LABEL[countryBox.level]}
                        </p>
                        {countryBox.d && (
                          <>
                            <Gauge d={countryBox.d} name={countryBox.name} />
                            <p>
                              Taux d'impôt estimé : <strong>{fmtRateD(countryBox.d)}</strong> (France : {fmtRate(FR_RATE)}, seuil
                              : {fmtRate(THRESHOLD)}).
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                <button type="button" className="btn btn-outline" onClick={restart}>
                  Recommencer{' '}
                  <span className={kbd} aria-hidden="true">
                    Entrée ↵
                  </span>
                </button>
              </div>
            )}
          </div>

          <p className="muted mt-4 text-center text-[14px]">
            Questionnaire informatif, sans valeur d'avis fiscal. D'après l'
            <a href="https://www.assemblee-nationale.fr/dyn/17/amendements/3210A/AN/2564" target="_blank" rel="noopener">
              amendement n° I-2564
            </a>{' '}
            et les données de{' '}
            <a href={SOURCE_SITE} target="_blank" rel="noopener">
              impotuniversel.fr
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
