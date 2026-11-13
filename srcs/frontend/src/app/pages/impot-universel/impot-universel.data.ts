/**
 * Questionnaire « Suis-je concerné·e par l'impôt universel ? »
 * Logique et données reprises du questionnaire indépendant https://www.impotuniversel.fr/
 * (dépôt https://github.com/elChapoSing/questionnaire-impot-universel), d'après l'amendement
 * n° I-2564 au projet de loi de finances pour 2027.
 *
 * Les données par pays (taux effectif estimé, notes, sources, barèmes) sont dans
 * public/data/impot-universel-pays.json, chargé uniquement sur cette page.
 */

export type Answer = 'yes' | 'no' | 'unknown';
export type RowState = 'met' | 'unmet' | 'unknown' | 'skipped';
export type Level = 'below' | 'debatable' | 'above';

export interface Step {
  id: string;
  label: string;
  q: string;
  help: string;
  type?: 'country';
  options: [string, Answer][];
  unmet: Answer;
  reason: string;
}

export const STEPS: Step[] = [
  {
    id: 'nat',
    label: 'Nationalité française',
    q: 'Avez-vous la nationalité française ?',
    help: '',
    options: [['Oui', 'yes'], ['Non', 'no']],
    unmet: 'no',
    reason: 'la mesure ne vise que les personnes de nationalité française.',
  },
  {
    id: 'rev',
    label: 'Revenu supérieur à 240 300 €',
    q: 'Votre revenu annuel dépasse-t-il 240 300 € ?',
    help: 'Ce seuil, valable en 2026, correspond à cinq fois le plafond annuel de la Sécurité sociale (48 060 €).',
    options: [['Oui, il dépasse 240 300 €', 'yes'], ['Non, il est inférieur', 'no']],
    unmet: 'no',
    reason: 'la mesure exige un revenu supérieur à cinq fois le plafond annuel de la Sécurité sociale, soit 240 300 € en 2026.',
  },
  {
    id: 'depart',
    label: 'Départ de France il y a moins de dix ans',
    q: 'Avez-vous quitté la France il y a moins de dix ans ?',
    help: 'La mesure porte sur les dix années qui suivent le départ.',
    options: [['Oui, moins de dix ans', 'yes'], ["Non, plus de dix ans, ou je n'ai pas quitté la France", 'no']],
    unmet: 'no',
    reason: "la mesure ne s'applique que pendant dix ans après le départ de France.",
  },
  {
    id: 'res',
    label: 'Trois ans de résidence en France sur les dix ans avant le départ',
    q: 'Avez-vous vécu en France au moins trois ans au cours des dix années précédant votre départ ?',
    help: "Il s'agit de la résidence fiscale en France. Si vous êtes parti·e de France depuis toujours, répondez non.",
    options: [['Oui, au moins trois ans', 'yes'], ['Non, moins de trois ans', 'no']],
    unmet: 'no',
    reason: "la mesure exige d'avoir résidé en France au moins trois ans au cours des dix années précédant le changement de résidence fiscale.",
  },
  {
    id: 'fisc',
    label: 'Fiscalité du pays de résidence inférieure de plus de 40 % à celle de la France',
    type: 'country',
    q: 'Dans quel pays résidez-vous fiscalement ?',
    help: 'Nous vérifions si la fiscalité de ce pays est inférieure de plus de 40 % à celle de la France (revenus du travail, du capital ou du patrimoine). Estimation : voir la méthodologie plus bas.',
    options: [["Je ne sais pas, ou mon pays n'est pas dans la liste", 'unknown']],
    unmet: 'no',
    reason: 'la mesure ne vise que les États dont la fiscalité est inférieure de plus de 40 % à celle de la France.',
  },
];

export interface Evaluation {
  verdict: 'no' | 'incomplete' | 'maybe' | 'yes';
  reason?: string;
  rows: { label: string; state: RowState }[];
}

/** Un « non » met fin au questionnaire : la mesure exige de remplir toutes les conditions. */
export function evaluate(answers: Answer[]): Evaluation {
  const rows = STEPS.map((s, i) => {
    const a = answers[i];
    const state: RowState = a === undefined ? 'skipped' : a === 'yes' ? 'met' : a === 'no' ? 'unmet' : 'unknown';
    return { label: s.label, state };
  });
  for (let i = 0; i < STEPS.length; i++) {
    if (answers[i] === STEPS[i].unmet) return { verdict: 'no', reason: STEPS[i].reason, rows };
  }
  if (answers.length < STEPS.length) return { verdict: 'incomplete', rows };
  return { verdict: answers.includes('unknown') ? 'maybe' : 'yes', rows };
}

// ---------- Données pays ----------

/** Taux effectif d'impôt sur le revenu en France pour un célibataire à 240 300 € (en %). */
export const FR_RATE = 35.23;
/** 60 % de la référence France (écart de 40 %). */
export const THRESHOLD = 21.14;
/** Bornes de prudence autour du seuil : ≤ 18 % concerné·e, > 26 % pas concerné·e, entre les deux cas limite. */
export const LEVEL_LOW = 18;
export const LEVEL_HIGH = 26;
export const REF_INCOME = 240300;

/** [titre, url, officielle (1) ou non (0)] */
export type Source = [string, string, 0 | 1];
/** [de, à (null = sans limite), taux en %] en devise locale */
export type Bracket = [number, number | null, number];

export interface CountryData {
  nom: string;
  continent: string;
  slug: string;
  rate: number;
  range?: [number, number];
  note: string;
  sources: Source[];
  calc: {
    devise: string;
    fx: number;
    fx_source: string;
    tranches: Bracket[];
    hypotheses: string[];
    credits?: [string, number][];
    deductions?: [string, number][];
    majorations?: [string, number][];
  };
}

export const DATA_URL = '/data/impot-universel-pays.json';
export const SOURCE_REPO = 'https://github.com/elChapoSing/questionnaire-impot-universel';
export const SOURCE_SITE = 'https://www.impotuniversel.fr/';

export const CONTINENTS: Record<string, string> = {
  europe: 'Europe',
  afrique: 'Afrique',
  asie: 'Asie et Moyen-Orient',
  'amerique-du-nord': 'Amérique du Nord, centrale et Caraïbes',
  'amerique-du-sud': 'Amérique du Sud',
  oceanie: 'Océanie',
};

export function levelOf(d: CountryData | undefined): Level {
  if (!d) return 'debatable';
  return d.rate <= LEVEL_LOW ? 'below' : d.rate <= LEVEL_HIGH ? 'debatable' : 'above';
}

export function answerOf(level: Level): Answer {
  return level === 'below' ? 'yes' : level === 'above' ? 'no' : 'unknown';
}

export const LEVEL_LABEL: Record<Level, string> = {
  below: 'Concerné·e',
  debatable: 'Cas limite',
  above: 'Pas concerné·e',
};

export const LEVEL_COMMENT: Record<Level, string> = {
  below:
    "D'après nos calculs, l'impôt sur le revenu effectif dans ce pays est largement sous le seuil de 21,1 %, c'est-à-dire plus de 40 % en dessous de celui de la France. La condition de fiscalité du pays de résidence est remplie.",
  debatable:
    "L'écart avec la France est proche du seuil de 40 %, et le résultat dépend de la méthode de comparaison : cotisations sociales, revenus du capital, régimes spéciaux. La condition de fiscalité est à examiner au cas par cas.",
  above:
    "D'après nos calculs, l'impôt sur le revenu effectif dans ce pays dépasse nettement le seuil de 21,1 %, donc l'écart avec la France est inférieur à 40 %. La condition de fiscalité du pays de résidence n'est pas remplie.",
};

export const UNRATED_COMMENT =
  "Ce pays n'a pas encore été analysé. Nous n'avons aucun calcul pour lui, donc le résultat reste indéterminé.";

/** Pays proposés dans le questionnaire (codes ISO 3166-1, hors France et territoires inhabités). */
export const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

export const NAME_OVERRIDES: Record<string, string> = { HK: 'Hong Kong (Chine)', MO: 'Macao (Chine)' };

export function fmtRate(r: number): string {
  return String(r).replace('.', ',') + ' %';
}

export function fmtRateD(d: CountryData): string {
  return d.range
    ? `entre ${String(d.range[0]).replace('.', ',')} et ${fmtRate(d.range[1])} selon le cas`
    : fmtRate(d.rate);
}

export function normalize(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
