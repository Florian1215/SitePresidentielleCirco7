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
import './ImpotUniversel.scss';

type Screen = { kind: 'start' } | { kind: 'step'; i: number } | { kind: 'result' };
type SortKey = 'pays' | 'rate';

const KEYS = ['A', 'B', 'C'];
/** Échelle de la jauge des taux (0 → 50 %). */
const GAUGE_MAX = 50;
const LEVELS: Level[] = ['below', 'debatable', 'above'];
const STATE_LABELS: Record<RowState, string> = { met: 'Remplie', unmet: 'Non remplie', unknown: 'À vérifier', skipped: 'Non évaluée' };

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

const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

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
    <div className="gauge" role="img" aria-label={`${name} : ${fmtRate(d.rate)}, seuil ${fmtRate(THRESHOLD)}, France ${fmtRate(FR_RATE)}`}>
      <div className="gauge-track">
        <span className="z z-below" style={{ width: pct(pos(LEVEL_LOW)) }}></span>
        <span className="z z-debatable" style={{ left: pct(pos(LEVEL_LOW)), width: pct(pos(LEVEL_HIGH) - pos(LEVEL_LOW)) }}></span>
        <span className="z z-above" style={{ left: pct(pos(LEVEL_HIGH)), right: '0%' }}></span>
        {d.range && <span className="g-range" style={{ left: pct(pos(d.range[0])), width: pct(pos(d.range[1]) - pos(d.range[0])) }}></span>}
        <span className="g-mark g-seuil" style={{ left: pct(pos(THRESHOLD)) }}>
          <em>Seuil {fmtRate(THRESHOLD)}</em>
        </span>
        <span className="g-mark g-fr" style={{ left: pct(pos(FR_RATE)) }}>
          <em>France {fmtRate(FR_RATE)}</em>
        </span>
        <span
          className={`g-pin${pos(d.rate) < 15 ? ' edge-l' : ''}${pos(d.rate) > 85 ? ' edge-r' : ''}`}
          style={{ left: pct(pos(d.rate)) }}
        >
          <em>
            {name} {fmtRate(d.rate)}
          </em>
        </span>
      </div>
      <div className="gauge-scale" aria-hidden="true">
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
      <p className="cb-note">{d.note}</p>

      <details className="calc">
        <summary>Voir le barème et les hypothèses du calcul</summary>
        <table className="brackets">
          <caption>
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
          <p className="calc-adj" key={adj.label}>
            <strong>{adj.label} :</strong>{' '}
            {adj.items.map((x, k) => (
              <Fragment key={k}>
                {x[0]} ({num(x[1])}){k === adj.items.length - 1 ? '' : ' ; '}
              </Fragment>
            ))}
          </p>
        ))}
        <ul className="calc-hyp">
          {d.calc.hypotheses.map((h, k) => (
            <li key={k}>{h}</li>
          ))}
        </ul>
        {d.calc.devise !== 'EUR' && (
          <p className="small muted">
            Taux de change utilisé : 1 € = {d.calc.fx} {d.calc.devise} ({d.calc.fx_source}).
          </p>
        )}
      </details>

      <p className="cb-srcs-title">Sources utilisées ({d.sources.length})</p>
      <ul className="cb-srcs">
        {d.sources.map((s) => (
          <li key={s[1]}>
            <a href={s[1]} target="_blank" rel="noopener">
              {s[0]}
            </a>{' '}
            <span className={`tag${s[2] ? ' tag-off' : ''}`}>{s[2] ? 'officielle' : 'non officielle'}</span>
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
    return { code: country, name: countryName(country), d, level, comment: d ? LEVEL_COMMENT[level] : UNRATED_COMMENT, unavailable: !d && dataError };
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
      <div className="quiz-screen" data-step={i} key={'step-' + i}>
        <p className="quiz-num">
          Question {i + 1} sur {STEPS.length}
        </p>
        <h2 tabIndex={-1}>{step.q}</h2>
        {step.help && <p className="quiz-help">{step.help}</p>}

        {step.type === 'country' && (
          <div className="picker">
            <input
              type="text"
              id="country-input"
              className="picker-input"
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
            <ul className="picker-list" id="country-list" role="listbox" aria-label="Pays">
              {shown.length ? (
                shown.map((c, k) => (
                  <li
                    key={c.code}
                    role="option"
                    className={`picker-item${k === active ? ' active' : ''}`}
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
                <li className="picker-empty">Aucun pays trouvé. Utilisez « Je ne sais pas » ci-dessous.</li>
              )}
            </ul>
          </div>
        )}

        <div className="options" role="group" aria-label="Réponses">
          {step.options.map((o, k) => (
            <button type="button" className="opt" key={o[1]} onClick={() => choose(i, o[1])}>
              <span className="key" aria-hidden="true">
                {KEYS[k]}
              </span>
              <span>{o[0]}</span>
            </button>
          ))}
        </div>

        <div className="quiz-foot">
          {i > 0 && (
            <button type="button" className="btn-link" onClick={() => back(i)}>
              ← Question précédente
            </button>
          )}
          <p className="quiz-hint">
            {step.type === 'country'
              ? 'Tapez le nom du pays, puis choisissez-le dans la liste (flèches et Entrée).'
              : `Astuce : appuyez sur ${KEYS.slice(0, step.options.length).join(' ou ')} pour répondre.`}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="page-iu">
      {/* HERO */}
      <section className="page-hero iu-hero">
        <div className="container">
          <span className="eyebrow">Impôt universel ciblé · Français de l'étranger</span>
          <h1>
            Seriez-vous <span className="hl-rouge">concerné·e&nbsp;?</span>
          </h1>
          <p className="lead">
            Ce n'est pas un impôt sur la nationalité française. C'est un <span className="hl">« impôt différentiel ciblé »</span>{' '}
            contre l'évasion fiscale : il vise certains départs vers des États à fiscalité largement privilégiée, et non à soumettre
            indistinctement tous les Français de l'étranger à l'impôt français.
          </p>
          <ul className="hero-facts">
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
      <section className="section-sm iu-quiz">
        <div className="container container-narrow">
          <div className="quiz card" ref={card} aria-live="polite">
            <div className="quiz-progress" aria-hidden="true">
              <span style={{ width: pct(progress) }}></span>
            </div>

            {screen.kind === 'start' && (
              <div className="quiz-screen">
                <span className="eyebrow">Questionnaire</span>
                <h2 tabIndex={-1}>Remplissez-vous les cinq conditions&nbsp;?</h2>
                <p className="quiz-lead">
                  Cinq questions, une minute. Vous saurez si vous remplissez les conditions prévues par le texte proposé.{' '}
                  <strong>Il faut les remplir toutes à la fois.</strong>
                </p>
                <ol className="cond-list">
                  {STEPS.map((s, i) => (
                    <li key={s.id}>
                      <span className="num-badge">{i + 1}</span>
                      {s.label}
                    </li>
                  ))}
                </ol>
                <div className="btn-row">
                  <button type="button" className="btn btn-rouge" onClick={start}>
                    Commencer{' '}
                    <span className="kbd" aria-hidden="true">
                      Entrée ↵
                    </span>
                  </button>
                </div>
                <p className="quiz-hint">Vos réponses restent dans votre navigateur. Rien n'est envoyé ni enregistré.</p>
              </div>
            )}

            {screen.kind === 'step' && renderStep(screen.i)}

            {screen.kind === 'result' && (
              <div className="quiz-screen">
                <span className={'verdict verdict-' + verdict.cls}>{verdict.badge}</span>
                <h2 tabIndex={-1}>{verdict.title}</h2>
                <p className="quiz-lead">{verdict.body}</p>

                <ul className="recap" aria-label="Récapitulatif des conditions">
                  {result.rows.map((row, k) => (
                    <li key={row.label} className={row.state === 'skipped' ? 'skipped' : undefined}>
                      <span>
                        {row.label}
                        {k === 4 && country && row.state !== 'skipped' && <> ({countryName(country)})</>}
                      </span>
                      <span className={'state state-' + row.state}>{STATE_LABELS[row.state]}</span>
                    </li>
                  ))}
                </ul>

                {countryBox && (
                  <div className={'countrybox lvl-' + (countryBox.unavailable ? 'debatable' : countryBox.level)}>
                    {countryBox.unavailable ? (
                      <>
                        <p className="cb-title">{countryBox.name} : données indisponibles</p>
                        <p>Les données n'ont pas pu être chargées (connexion). Le résultat pour ce pays reste indéterminé.</p>
                      </>
                    ) : (
                      <>
                        <p className="cb-title">
                          {countryBox.name} (critère fiscal) : {LEVEL_LABEL[countryBox.level]}
                        </p>
                        <p>{countryBox.comment}</p>
                        {countryBox.d && (
                          <>
                            <Gauge d={countryBox.d} name={countryBox.name} />
                            <p className="cb-detail">
                              Taux effectif estimé : <strong>{fmtRateD(countryBox.d)}</strong> (France : {fmtRate(FR_RATE)}, seuil :{' '}
                              {fmtRate(THRESHOLD)}).
                            </p>
                            <Detail d={countryBox.d} />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="btn-row">
                  <button type="button" className="btn btn-outline" onClick={restart}>
                    Recommencer{' '}
                    <span className="kbd" aria-hidden="true">
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

          <p className="iu-legal muted">
            Ce questionnaire est informatif. Il ne constitue pas un avis fiscal ou juridique. Il s'appuie sur le dispositif de
            l'amendement n° I-2564 au projet de loi de finances pour 2027.
          </p>
        </div>
      </section>

      {/* CE QUE PRÉVOIT LA MESURE */}
      <section className="section bg-violet">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Ce que prévoit le texte</span>
            <h2>Un impôt différentiel, pas une double imposition</h2>
            <p className="lead">
              Si vous remplissez toutes les conditions, vous acquittez en France l'impôt français{' '}
              <strong>moins l'impôt déjà payé dans votre pays de résidence</strong> (crédit d'impôt), sous réserve des conventions
              fiscales signées par la France.
            </p>
          </div>
          <ol className="rules">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <span className="rule-num">{i + 1}</span>
                <h3>{s.label}</h3>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* DONNÉES PAR PAYS */}
      <section className="section bg-blanc" id="iu-pays">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Fiscalité par pays</span>
            <h2>Impôt sur le revenu, pays par pays</h2>
            <p className="lead">
              Taux effectif estimé pour une personne seule à {num(REF_INCOME)} € de revenu imposable. Seuil : {fmtRate(THRESHOLD)},
              soit 40 % sous la France ({fmtRate(FR_RATE)}). Cliquez sur un pays pour voir le calcul détaillé et les sources.
            </p>
          </div>

          {dataError ? (
            <p className="alert alert-err">Les données par pays n'ont pas pu être chargées. Réessayez plus tard.</p>
          ) : !data ? (
            <p className="loader">Chargement des données pays…</p>
          ) : (
            <>
              <div className="filters">
                <input
                  type="search"
                  className="filter-search"
                  placeholder="Rechercher un pays, un continent…"
                  aria-label="Rechercher dans le tableau"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="chips" role="group" aria-label="Filtrer par niveau">
                  <button type="button" className={`chip${levelFilter === '' ? ' on' : ''}`} onClick={() => setLevelFilter('')}>
                    Tous <span>{rows.length}</span>
                  </button>
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={`chip chip-${l}${levelFilter === l ? ' on' : ''}`}
                      aria-pressed={levelFilter === l}
                      onClick={() => setLevelFilter(l)}
                    >
                      {LEVEL_LABEL[l]} <span>{counts[l]}</span>
                    </button>
                  ))}
                </div>
                <select aria-label="Filtrer par continent" className="filter-select" value={continentFilter} onChange={(e) => setContinentFilter(e.target.value)}>
                  <option value="">Tous les continents</option>
                  {Object.entries(CONTINENTS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ctable" role="table" aria-label="Taux estimé par pays">
                <div className="ctable-head" role="row">
                  <span role="columnheader" aria-sort={ariaSort('pays')}>
                    <button type="button" className="sort" onClick={() => sortBy('pays')}>
                      Pays {arrow('pays')}
                    </button>
                  </span>
                  <span role="columnheader" className="col-cont">
                    Continent
                  </span>
                  <span role="columnheader" aria-sort={ariaSort('rate')}>
                    <button type="button" className="sort" onClick={() => sortBy('rate')}>
                      Taux estimé {arrow('rate')}
                    </button>
                  </span>
                  <span role="columnheader">Niveau</span>
                </div>
                {filteredRows.length ? (
                  filteredRows.map((r) => (
                    <details className="crow" role="row" key={r.code}>
                      <summary>
                        <span className="c-name" role="cell">
                          {r.name}
                        </span>
                        <span className="col-cont" role="cell">
                          {r.continent}
                        </span>
                        <span className="c-rate" role="cell">
                          <span className="minibar" aria-hidden="true">
                            <span className={'lvl-' + r.level} style={{ width: pct(pos(r.d.rate)) }}></span>
                          </span>
                          {r.d.range ? fmtRate(r.d.range[0]).replace(' %', '') + '–' + fmtRate(r.d.range[1]) : fmtRate(r.d.rate)}
                        </span>
                        <span role="cell">
                          <span className={'lvlchip lvl-' + r.level}>{LEVEL_LABEL[r.level]}</span>
                        </span>
                      </summary>
                      <div className="crow-body">
                        <Gauge d={r.d} name={r.name} />
                        <Detail d={r.d} />
                      </div>
                    </details>
                  ))
                ) : (
                  <p className="ctable-empty">Aucun pays ne correspond à ces filtres.</p>
                )}
              </div>
              <p className="muted small">
                {filteredRows.length} pays affichés. Les pays absents de la liste n'ont pas encore été analysés et sont classés « cas
                limite ».
              </p>
            </>
          )}
        </div>
      </section>

      {/* MÉTHODOLOGIE */}
      <section className="section bg-lavande" id="iu-methodologie">
        <div className="container container-narrow">
          <div className="section-head">
            <span className="eyebrow">Méthodologie</span>
            <h2>Comment est évaluée la condition de fiscalité</h2>
            <p className="lead">
              L'amendement n° I-2564 vise les résidents d'un État dont la fiscalité des revenus du travail, du capital ou du patrimoine
              est inférieure de plus de 40 % à celle de la France. Le texte ne dit pas comment mesurer cet écart. Il s'agit ici d'une
              estimation indépendante, qui ne remplace ni un avis fiscal ni l'avis de l'administration.
            </p>
          </div>

          <div className="meth">
            <div className="card">
              <h3>Hypothèses</h3>
              <ul>
                <li>
                  Indicateur : taux effectif d'impôt sur le revenu d'une personne seule, sans enfant, percevant un salaire imposable de
                  240 300 € (5 fois le plafond de la Sécurité sociale 2026, fixé à 48 060 €).
                </li>
                <li>
                  Référence France : {fmtRate(FR_RATE)} (84 658,84 € d'impôt), d'après le barème progressif de l'impôt sur le revenu.
                  Le seuil est donc de 60 % de ce taux, soit {fmtRate(THRESHOLD)}.
                </li>
                <li>
                  Pour chaque pays : barème national progressif, auquel s'ajoute l'impôt local ou la surtaxe nationale quand ils ont pu
                  être sourcés. Les cotisations sociales, la TVA, les taxes foncières, l'impôt sur la fortune et l'imposition du capital
                  ne sont pas comptés.
                </li>
                <li>
                  Taux de change : cours Yahoo Finance (paires directes contre l'euro) vérifiés le 13 novembre 2026, appliqués à tous
                  les pays sauf mention contraire (Mongolie, Myanmar, Samoa, Sao Tomé-et-Principe, Érythrée : cours indisponible,
                  hypothèse signalée dans la fiche du pays). Le niveau de réponse n'est sensible au change que pour les pays proches des
                  bornes de 18 % et 26 %.
                </li>
                <li>
                  Les exceptions prévues par des conventions fiscales (par exemple pour les Français résidant à Monaco) ne sont pas
                  modélisées.
                </li>
              </ul>
            </div>

            <div className="card">
              <h3>Les trois niveaux de réponse</h3>
              <div className="levels">
                <div className="level lvl-below">
                  <span className="lvlchip lvl-below">{LEVEL_LABEL.below}</span>
                  <p>Taux estimé inférieur ou égal à {fmtRate(LEVEL_LOW)}. La condition est considérée comme remplie.</p>
                </div>
                <div className="level lvl-debatable">
                  <span className="lvlchip lvl-debatable">{LEVEL_LABEL.debatable}</span>
                  <p>
                    Taux estimé entre {fmtRate(LEVEL_LOW)} et {fmtRate(LEVEL_HIGH)}, ou pays pas encore analysé. La condition reste à
                    vérifier. Ces bornes laissent une marge de prudence autour du seuil de {fmtRate(THRESHOLD)} pour tenir compte des
                    incertitudes de calcul.
                  </p>
                </div>
                <div className="level lvl-above">
                  <span className="lvlchip lvl-above">{LEVEL_LABEL.above}</span>
                  <p>Taux estimé supérieur à {fmtRate(LEVEL_HIGH)}. La condition est considérée comme non remplie.</p>
                </div>
              </div>
              <p className="small muted">
                Les sources « officielle » émanent d'une administration fiscale ou d'un ministère. Les sources « non officielle » sont
                des médias ou des sites juridiques privés : à confirmer auprès des autorités du pays.
              </p>
            </div>

            <div className="card">
              <h3>Limites</h3>
              <ul>
                <li>Les pays qui n'ont pas encore été analysés sont classés « cas limite ».</li>
                <li>Les barèmes changent chaque année. Les chiffres reflètent les textes consultés en 2026.</li>
                <li>
                  Un taux effectif calculé à un seul niveau de revenu ne dit rien des régimes spéciaux (expatriés, non-domiciliés, zones
                  franches).
                </li>
                <li>
                  Japon : l'impôt local (10 %) n'est pas inclus faute de source. Hongrie : la contribution sociale de 13 % n'est pas
                  comptée. Vietnam : ordre de grandeur uniquement. Émirats : source officielle encore à ajouter.
                </li>
              </ul>
            </div>
          </div>

          <div className="iu-sources">
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
            <p className="small muted">Questionnaire informatif, sans valeur d'avis fiscal ou juridique.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
