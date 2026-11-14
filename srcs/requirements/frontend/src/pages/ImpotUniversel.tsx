import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  CONTINENTS,
  COUNTRY_CODES,
  DATA_URL,
  FR_RATE,
  LEVEL_COMMENT,
  LEVEL_HIGH,
  LEVEL_LABEL,
  LEVEL_LOW,
  NAME_OVERRIDES,
  REF_INCOME,
  SOURCE_REPO,
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
import { usePageTitle } from '../lib/title';

type Screen = { kind: 'start' } | { kind: 'step'; i: number } | { kind: 'result' };
type SortKey = 'pays' | 'rate';

const KEYS = ['A', 'B', 'C'];
/** Échelle de la jauge des taux (0 → 50 %). */
const GAUGE_MAX = 50;
const LEVELS: Level[] = ['below', 'debatable', 'above'];
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

/** Étiquette d'un niveau (tableau des pays, méthodologie). */
const LVLCHIP =
  'inline-block rounded-full px-2.5 py-1 text-[12px] font-bold tracking-[0.05em] whitespace-nowrap uppercase max-[720px]:px-2 max-[720px]:py-[3px] max-[720px]:text-[11px]';
/** Libellé d'un repère de la jauge (seuil, France, pays). */
const GAUGE_LABEL =
  'absolute text-[12px] font-bold whitespace-nowrap not-italic [font-variation-settings:normal] max-[720px]:text-[11px]';
/** Repère vertical de la jauge (seuil, France). */
const GAUGE_MARK = 'absolute -top-1.5 -bottom-1.5 w-0.5 -translate-x-px';
/** En-tête et lignes du tableau des pays : mêmes colonnes. */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_150px] items-center gap-4 px-[18px] py-3 max-[720px]:grid-cols-[minmax(0,1fr)_auto_auto] max-[720px]:gap-2.5 max-[720px]:px-3.5';
/** Filtres du tableau par niveau ; la puce active prend la couleur du niveau. */
const CHIP =
  'cursor-pointer rounded-full border-2 px-3.5 py-2 [font-family:inherit] text-[14px] leading-[inherit] font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-jaune [&>span]:ml-1 [&>span]:opacity-60';
const CHIP_OFF = 'border-gris bg-white text-noir hover:border-violet';
const CHIP_ON: Record<Level | '', string> = {
  '': 'border-violet bg-violet text-creme',
  below: 'border-vert bg-vert text-creme',
  debatable: 'border-jaune bg-jaune text-noir',
  above: 'border-rouge bg-rouge text-creme',
};
const BRACKETS =
  'w-full max-w-[520px] border-collapse text-[14px] tabular-nums [&_td]:border-b [&_td]:border-gris [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:text-right [&_td:first-child]:text-left [&_th]:border-b [&_th]:border-gris [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-right [&_th]:text-[12px] [&_th]:tracking-[0.05em] [&_th]:text-texte [&_th]:uppercase [&_th:first-child]:text-left';
const QUIZ_HINT = 'text-[14px] text-texte';

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

const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
  a.name.localeCompare(b.name, 'fr'),
);

function pos(rate: number): number {
  return Math.min(100, Math.max(0, (rate / GAUGE_MAX) * 100));
}

function num(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
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

function adjustments(d: CountryData) {
  return (
    [
      ['Déductions', d.calc.deductions],
      ['Réductions et crédits', d.calc.credits],
      ['Majorations', d.calc.majorations],
    ] as const
  )
    .filter(([, items]) => items?.length)
    .map(([label, items]) => ({ label, items: items! }));
}

/** Détail d'un pays : note, calcul, sources. */
function Detail({ d }: { d: CountryData }) {
  return (
    <>
      <p className="text-[15px]">{d.note}</p>

      <details className="my-2 [&[open]>summary]:mb-3">
        <summary className="cursor-pointer text-[15px] font-bold text-violet">Voir le barème et les hypothèses du calcul</summary>
        <table className={BRACKETS}>
          <caption className="mb-1.5 text-left text-[13px] text-texte">
            Barème appliqué ({d.calc.devise}) — revenu de référence : {num(REF_INCOME * d.calc.fx)} {d.calc.devise}
          </caption>
          <thead>
            <tr>
              <th scope="col">De</th>
              <th scope="col">À</th>
              <th scope="col">Taux</th>
            </tr>
          </thead>
          <tbody>
            {d.calc.tranches.map((b, k) => (
              <tr key={k}>
                <td>{num(b[0])}</td>
                <td>{b[1] === null ? 'au-delà' : num(b[1])}</td>
                <td>{fmtRate(b[2])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {adjustments(d).map((adj) => (
          <p className="mt-2.5 mb-0 text-[14px]" key={adj.label}>
            <strong>{adj.label} :</strong>{' '}
            {adj.items.map((x, k) => (
              <Fragment key={k}>
                {x[0]} ({num(x[1])}){k === adj.items.length - 1 ? '' : ' ; '}
              </Fragment>
            ))}
          </p>
        ))}
        <ul className="my-3 pl-[1.2em] text-[14px] text-texte [&_li]:mb-1">
          {d.calc.hypotheses.map((h, k) => (
            <li key={k}>{h}</li>
          ))}
        </ul>
        {d.calc.devise !== 'EUR' && (
          <p className="muted text-[14px]">
            Taux de change utilisé : 1 € = {d.calc.fx} {d.calc.devise} ({d.calc.fx_source}).
          </p>
        )}
      </details>

      <p className="mt-3 mb-1.5 text-[14px] font-bold">Sources utilisées ({d.sources.length})</p>
      <ul className="m-0 pl-[1.2em] text-[14px] [&_li]:mb-1">
        {d.sources.map((s) => (
          <li key={s[1]}>
            <a href={s[1]} target="_blank" rel="noopener">
              {s[0]}
            </a>{' '}
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.05em] uppercase ${s[2] ? 'bg-lavande text-violet' : 'bg-gris text-texte'}`}
            >
              {s[2] ? 'officielle' : 'non officielle'}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Page « Impôt universel : suis-je concerné·e ? » (/impot-universel).
 * Volontairement non liée depuis le reste du site pour l'instant (et non indexée).
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

  // ---------- Tableau des pays ----------
  const [search, setSearch] = useState('');
  const [continentFilter, setContinentFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<Level | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('pays');
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(
    () =>
      data
        ? Object.entries(data).map(([code, d]) => ({
            code,
            d,
            name: countryName(code) || d.nom,
            continent: CONTINENTS[d.continent] ?? '',
            level: levelOf(d),
          }))
        : [],
    [data],
  );

  const counts = useMemo(() => {
    const c: Record<Level, number> = { below: 0, debatable: 0, above: 0 };
    for (const r of rows) c[r.level]++;
    return c;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = normalize(search);
    const dir = sortAsc ? 1 : -1;
    return rows
      .filter((r) => (!continentFilter || r.d.continent === continentFilter) && (!levelFilter || r.level === levelFilter))
      .filter((r) => !q || normalize(`${r.name} ${r.d.nom} ${r.continent} ${r.d.note}`).includes(q))
      .sort((a, b) => dir * (sortKey === 'rate' ? a.d.rate - b.d.rate : a.name.localeCompare(b.name, 'fr')));
  }, [rows, search, continentFilter, levelFilter, sortKey, sortAsc]);

  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const ariaSort = (key: SortKey) => (sortKey === key ? (sortAsc ? 'ascending' : 'descending') : 'none');
  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? '↑' : '↓') : '');

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
          <p className={`m-0 ${QUIZ_HINT}`}>
            {step.type === 'country'
              ? 'Tapez le nom du pays, puis choisissez-le dans la liste (flèches et Entrée).'
              : `Astuce : appuyez sur ${KEYS.slice(0, step.options.length).join(' ou ')} pour répondre.`}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* HERO */}
      <section className="page-hero border-b-0 pb-[clamp(24px,4vw,40px)]">
        <div className="site-container">
          <span className="eyebrow">Impôt universel ciblé · Français de l'étranger</span>
          <h1>
            Seriez-vous <span className="hl-rouge">concerné·e&nbsp;?</span>
          </h1>
          <p className="lead max-w-[820px]">
            Ce n'est pas un impôt sur la nationalité française. C'est un <span className="hl">« impôt différentiel ciblé »</span>{' '}
            contre l'évasion fiscale : il vise certains départs vers des États à fiscalité largement privilégiée, et non à
            soumettre indistinctement tous les Français de l'étranger à l'impôt français.
          </p>
          <ul className="mx-0 mt-7 mb-0 flex list-none flex-wrap gap-x-8 gap-y-3 p-0 [&_li]:flex [&_li]:items-baseline [&_li]:gap-2 [&_span]:text-[14px] [&_span]:font-bold [&_span]:tracking-[0.06em] [&_span]:text-violet [&_span]:uppercase [&_strong]:font-titre [&_strong]:text-[clamp(36px,5vw,52px)] [&_strong]:leading-none [&_strong]:font-normal [&_strong]:text-rouge">
            <li>
              <strong>5</strong>
              <span>questions</span>
            </li>
            <li>
              <strong>1</strong>
              <span>minute</span>
            </li>
            <li>
              <strong>{rows.length || 198}</strong>
              <span>pays analysés</span>
            </li>
          </ul>
        </div>
      </section>

      {/* QUESTIONNAIRE */}
      <section className="section-sm pt-0">
        <div className="site-container max-w-[820px]">
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
                <span className="eyebrow">Questionnaire</span>
                <h2 tabIndex={-1}>Remplissez-vous les cinq conditions&nbsp;?</h2>
                <p className="text-[18px] leading-[1.5]">
                  Cinq questions, une minute. Vous saurez si vous remplissez les conditions prévues par le texte proposé.{' '}
                  <strong>Il faut les remplir toutes à la fois.</strong>
                </p>
                <ol className="mx-0 mt-2 mb-7 grid list-none gap-2.5 p-0">
                  {STEPS.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3.5 font-medium">
                      <span className="num-badge h-[34px] w-[34px] bg-violet text-[18px]">{i + 1}</span>
                      {s.label}
                    </li>
                  ))}
                </ol>
                <div className="btn-row items-center gap-x-6 gap-y-3">
                  <button type="button" className="btn btn-rouge" onClick={start}>
                    Commencer{' '}
                    <span
                      className="rounded border border-current px-1.5 py-0.5 text-[12px] font-medium tracking-normal normal-case opacity-75"
                      aria-hidden="true"
                    >
                      Entrée ↵
                    </span>
                  </button>
                </div>
                <p className={`mx-0 mt-4 mb-0 ${QUIZ_HINT}`}>
                  Vos réponses restent dans votre navigateur. Rien n'est envoyé ni enregistré.
                </p>
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
                <p className="text-[18px] leading-[1.5]">{verdict.body}</p>

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
                      <>
                        <p className="text-[18px] font-bold">{countryBox.name} : données indisponibles</p>
                        <p>Les données n'ont pas pu être chargées (connexion). Le résultat pour ce pays reste indéterminé.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[18px] font-bold">
                          {countryBox.name} (critère fiscal) : {LEVEL_LABEL[countryBox.level]}
                        </p>
                        <p>{countryBox.comment}</p>
                        {countryBox.d && (
                          <>
                            <Gauge d={countryBox.d} name={countryBox.name} />
                            <p className="mt-2">
                              Taux effectif estimé : <strong>{fmtRateD(countryBox.d)}</strong> (France : {fmtRate(FR_RATE)}, seuil
                              : {fmtRate(THRESHOLD)}).
                            </p>
                            <Detail d={countryBox.d} />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="btn-row items-center gap-x-6 gap-y-3">
                  <button type="button" className="btn btn-outline" onClick={restart}>
                    Recommencer{' '}
                    <span
                      className="rounded border border-current px-1.5 py-0.5 text-[12px] font-medium tracking-normal normal-case opacity-75"
                      aria-hidden="true"
                    >
                      Entrée ↵
                    </span>
                  </button>
                  <a href="#iu-pays" className="btn-link">
                    Voir tous les pays ↓
                  </a>
                </div>
              </div>
            )}
          </div>

          <p className="muted mt-4 text-center text-[14px]">
            Ce questionnaire est informatif. Il ne constitue pas un avis fiscal ou juridique. Il s'appuie sur le dispositif de
            l'amendement n° I-2564 au projet de loi de finances pour 2027.
          </p>
        </div>
      </section>

      {/* CE QUE PRÉVOIT LA MESURE */}
      <section className="section section-violet">
        <div className="site-container">
          <div className="section-head">
            <span className="eyebrow">Ce que prévoit le texte</span>
            <h2>Un impôt différentiel, pas une double imposition</h2>
            <p className="lead">
              Si vous remplissez toutes les conditions, vous acquittez en France l'impôt français{' '}
              <strong>moins l'impôt déjà payé dans votre pays de résidence</strong> (crédit d'impôt), sous réserve des conventions
              fiscales signées par la France.
            </p>
          </div>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4 p-0">
            {STEPS.map((s, i) => (
              <li key={s.id} className="rounded-site border border-[rgba(255,252,244,0.25)] bg-[rgba(255,252,244,0.08)] p-5">
                <span className="inline-grid h-10 w-10 place-items-center rounded-full bg-jaune font-titre text-[22px] text-noir">
                  {i + 1}
                </span>
                <h3 className="mt-3 mb-0 text-[20px]">{s.label}</h3>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* DONNÉES PAR PAYS */}
      <section className="section bg-white" id="iu-pays">
        <div className="site-container">
          <div className="section-head">
            <span className="eyebrow">Fiscalité par pays</span>
            <h2>Impôt sur le revenu, pays par pays</h2>
            <p className="lead">
              Taux effectif estimé pour une personne seule à {num(REF_INCOME)} € de revenu imposable. Seuil : {fmtRate(THRESHOLD)}
              , soit 40 % sous la France ({fmtRate(FR_RATE)}). Cliquez sur un pays pour voir le calcul détaillé et les sources.
            </p>
          </div>

          {dataError ? (
            <p className="alert alert-err">Les données par pays n'ont pas pu être chargées. Réessayez plus tard.</p>
          ) : !data ? (
            <p className="loader">Chargement des données pays…</p>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-[1fr_auto] gap-3 [grid-template-areas:'search_select'_'chips_chips'] max-[720px]:grid-cols-1 max-[720px]:[grid-template-areas:'search'_'select'_'chips']">
                <input
                  type="search"
                  className="[grid-area:search]"
                  placeholder="Rechercher un pays, un continent…"
                  aria-label="Rechercher dans le tableau"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 [grid-area:chips]" role="group" aria-label="Filtrer par niveau">
                  <button
                    type="button"
                    className={`${CHIP} ${levelFilter === '' ? CHIP_ON[''] : CHIP_OFF}`}
                    onClick={() => setLevelFilter('')}
                  >
                    Tous <span>{rows.length}</span>
                  </button>
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={`${CHIP} ${levelFilter === l ? CHIP_ON[l] : CHIP_OFF}`}
                      aria-pressed={levelFilter === l}
                      onClick={() => setLevelFilter(l)}
                    >
                      {LEVEL_LABEL[l]} <span>{counts[l]}</span>
                    </button>
                  ))}
                </div>
                <select
                  aria-label="Filtrer par continent"
                  className="w-auto min-w-[240px] [grid-area:select] max-[720px]:w-full max-[720px]:min-w-0"
                  value={continentFilter}
                  onChange={(e) => setContinentFilter(e.target.value)}
                >
                  <option value="">Tous les continents</option>
                  {Object.entries(CONTINENTS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="mb-3 overflow-hidden rounded-site border border-gris"
                role="table"
                aria-label="Taux estimé par pays"
              >
                <div
                  className={`${ROW_GRID} bg-gris-clair text-[13px] font-bold tracking-[0.06em] text-texte uppercase`}
                  role="row"
                >
                  <span role="columnheader" aria-sort={ariaSort('pays')}>
                    <button
                      type="button"
                      className="cursor-pointer border-0 bg-transparent p-0 [font:inherit] tracking-[inherit] text-violet [text-transform:inherit] hover:underline"
                      onClick={() => sortBy('pays')}
                    >
                      Pays {arrow('pays')}
                    </button>
                  </span>
                  <span role="columnheader" className="text-[14px] text-texte max-[720px]:hidden">
                    Continent
                  </span>
                  <span role="columnheader" aria-sort={ariaSort('rate')}>
                    <button
                      type="button"
                      className="cursor-pointer border-0 bg-transparent p-0 [font:inherit] tracking-[inherit] text-violet [text-transform:inherit] hover:underline"
                      onClick={() => sortBy('rate')}
                    >
                      Taux estimé {arrow('rate')}
                    </button>
                  </span>
                  <span role="columnheader">Niveau</span>
                </div>
                {filteredRows.length ? (
                  filteredRows.map((r) => (
                    <details className="group/row border-t border-gris [&[open]>summary]:bg-lavande" role="row" key={r.code}>
                      <summary
                        className={`${ROW_GRID} cursor-pointer list-none hover:bg-creme focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-jaune [&::-webkit-details-marker]:hidden`}
                      >
                        <span
                          className="font-bold text-violet before:text-rouge before:content-['+_'] group-open/row:before:content-['−_']"
                          role="cell"
                        >
                          {r.name}
                        </span>
                        <span className="text-[14px] text-texte max-[720px]:hidden" role="cell">
                          {r.continent}
                        </span>
                        <span className="flex items-center gap-2.5 font-medium tabular-nums" role="cell">
                          <span
                            className="h-1.5 w-[60px] shrink-0 overflow-hidden rounded-full bg-gris max-[720px]:hidden"
                            aria-hidden="true"
                          >
                            <span className={`block h-full ${LVL[r.level].bar}`} style={{ width: pct(pos(r.d.rate)) }}></span>
                          </span>
                          {r.d.range ? fmtRate(r.d.range[0]).replace(' %', '') + '–' + fmtRate(r.d.range[1]) : fmtRate(r.d.rate)}
                        </span>
                        <span role="cell">
                          <span className={`${LVLCHIP} ${LVL[r.level].light}`}>{LEVEL_LABEL[r.level]}</span>
                        </span>
                      </summary>
                      <div className="max-w-[900px] bg-white px-[18px] pt-1 pb-5 max-[720px]:px-3.5 max-[720px]:pb-[18px]">
                        <Gauge d={r.d} name={r.name} />
                        <Detail d={r.d} />
                      </div>
                    </details>
                  ))
                ) : (
                  <p className="m-0 px-[18px] py-6 text-texte">Aucun pays ne correspond à ces filtres.</p>
                )}
              </div>
              <p className="muted text-[14px]">
                {filteredRows.length} pays affichés. Les pays absents de la liste n'ont pas encore été analysés et sont classés «
                cas limite ».
              </p>
            </>
          )}
        </div>
      </section>

      {/* MÉTHODOLOGIE */}
      <section className="section bg-lavande" id="iu-methodologie">
        <div className="site-container max-w-[820px]">
          <div className="section-head">
            <span className="eyebrow">Méthodologie</span>
            <h2>Comment est évaluée la condition de fiscalité</h2>
            <p className="lead">
              L'amendement n° I-2564 vise les résidents d'un État dont la fiscalité des revenus du travail, du capital ou du
              patrimoine est inférieure de plus de 40 % à celle de la France. Le texte ne dit pas comment mesurer cet écart. Il
              s'agit ici d'une estimation indépendante, qui ne remplace ni un avis fiscal ni l'avis de l'administration.
            </p>
          </div>

          <div className="grid gap-5 [&_li]:mb-2 [&_ul]:m-0 [&_ul]:pl-[1.2em]">
            <div className="card">
              <h3>Hypothèses</h3>
              <ul>
                <li>
                  Indicateur : taux effectif d'impôt sur le revenu d'une personne seule, sans enfant, percevant un salaire
                  imposable de 240 300 € (5 fois le plafond de la Sécurité sociale 2026, fixé à 48 060 €).
                </li>
                <li>
                  Référence France : {fmtRate(FR_RATE)} (84 658,84 € d'impôt), d'après le barème progressif de l'impôt sur le
                  revenu. Le seuil est donc de 60 % de ce taux, soit {fmtRate(THRESHOLD)}.
                </li>
                <li>
                  Pour chaque pays : barème national progressif, auquel s'ajoute l'impôt local ou la surtaxe nationale quand ils
                  ont pu être sourcés. Les cotisations sociales, la TVA, les taxes foncières, l'impôt sur la fortune et
                  l'imposition du capital ne sont pas comptés.
                </li>
                <li>
                  Taux de change : cours Yahoo Finance (paires directes contre l'euro) vérifiés le 13 novembre 2026, appliqués à
                  tous les pays sauf mention contraire (Mongolie, Myanmar, Samoa, Sao Tomé-et-Principe, Érythrée : cours
                  indisponible, hypothèse signalée dans la fiche du pays). Le niveau de réponse n'est sensible au change que pour
                  les pays proches des bornes de 18 % et 26 %.
                </li>
                <li>
                  Les exceptions prévues par des conventions fiscales (par exemple pour les Français résidant à Monaco) ne sont
                  pas modélisées.
                </li>
              </ul>
            </div>

            <div className="card">
              <h3>Les trois niveaux de réponse</h3>
              <div className="mb-4 grid gap-3">
                <div className={`border-l-4 py-1 pl-3.5 [&_p]:mt-1.5 [&_p]:mb-0 ${LVL.below.border}`}>
                  <span className={`${LVLCHIP} ${LVL.below.light}`}>{LEVEL_LABEL.below}</span>
                  <p>Taux estimé inférieur ou égal à {fmtRate(LEVEL_LOW)}. La condition est considérée comme remplie.</p>
                </div>
                <div className={`border-l-4 py-1 pl-3.5 [&_p]:mt-1.5 [&_p]:mb-0 ${LVL.debatable.border}`}>
                  <span className={`${LVLCHIP} ${LVL.debatable.light}`}>{LEVEL_LABEL.debatable}</span>
                  <p>
                    Taux estimé entre {fmtRate(LEVEL_LOW)} et {fmtRate(LEVEL_HIGH)}, ou pays pas encore analysé. La condition
                    reste à vérifier. Ces bornes laissent une marge de prudence autour du seuil de {fmtRate(THRESHOLD)} pour tenir
                    compte des incertitudes de calcul.
                  </p>
                </div>
                <div className={`border-l-4 py-1 pl-3.5 [&_p]:mt-1.5 [&_p]:mb-0 ${LVL.above.border}`}>
                  <span className={`${LVLCHIP} ${LVL.above.light}`}>{LEVEL_LABEL.above}</span>
                  <p>Taux estimé supérieur à {fmtRate(LEVEL_HIGH)}. La condition est considérée comme non remplie.</p>
                </div>
              </div>
              <p className="muted text-[14px]">
                Les sources « officielle » émanent d'une administration fiscale ou d'un ministère. Les sources « non officielle »
                sont des médias ou des sites juridiques privés : à confirmer auprès des autorités du pays.
              </p>
            </div>

            <div className="card">
              <h3>Limites</h3>
              <ul>
                <li>Les pays qui n'ont pas encore été analysés sont classés « cas limite ».</li>
                <li>Les barèmes changent chaque année. Les chiffres reflètent les textes consultés en 2026.</li>
                <li>
                  Un taux effectif calculé à un seul niveau de revenu ne dit rien des régimes spéciaux (expatriés, non-domiciliés,
                  zones franches).
                </li>
                <li>
                  Japon : l'impôt local (10 %) n'est pas inclus faute de source. Hongrie : la contribution sociale de 13 % n'est
                  pas comptée. Vietnam : ordre de grandeur uniquement. Émirats : source officielle encore à ajouter.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 [&_li]:mb-1.5 [&_ul]:pl-[1.2em]">
            <h3>Sources</h3>
            <ul>
              <li>
                <a href="https://www.assemblee-nationale.fr/dyn/17/amendements/3210A/AN/2564" target="_blank" rel="noopener">
                  Texte de l'amendement n° I-2564 (Assemblée nationale)
                </a>
              </li>
              <li>
                <a
                  href="https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds-securite-sociale.html"
                  target="_blank"
                  rel="noopener"
                >
                  Plafond annuel de la Sécurité sociale 2026 : 48 060 € (Urssaf)
                </a>
              </li>
              <li>
                <a href="https://melenchon2027.fr/programme/livre/" target="_blank" rel="noopener">
                  Programme L'Avenir en commun
                </a>
              </li>
              <li>
                Questionnaire, méthode et données par pays reprises de{' '}
                <a href={SOURCE_SITE} target="_blank" rel="noopener">
                  impotuniversel.fr
                </a>{' '}
                (
                <a href={SOURCE_REPO} target="_blank" rel="noopener">
                  calculs détaillés sur GitHub
                </a>
                ).
              </li>
            </ul>
            <p className="muted text-[14px]">Questionnaire informatif, sans valeur d'avis fiscal ou juridique.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
