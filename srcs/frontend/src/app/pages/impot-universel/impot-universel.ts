import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import {
  Answer,
  CONTINENTS,
  COUNTRY_CODES,
  CountryData,
  DATA_URL,
  FR_RATE,
  LEVEL_COMMENT,
  LEVEL_HIGH,
  LEVEL_LABEL,
  LEVEL_LOW,
  Level,
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
} from './impot-universel.data';

type Screen = { kind: 'start' } | { kind: 'step'; i: number } | { kind: 'result' };
type SortKey = 'pays' | 'rate';

const KEYS = ['A', 'B', 'C'];
/** Échelle de la jauge des taux (0 → 50 %). */
const GAUGE_MAX = 50;

/**
 * Page « Impôt universel : suis-je concerné·e ? » (/impot-universel).
 * Volontairement non liée depuis le reste du site pour l'instant (et non indexée).
 */
@Component({
  selector: 'app-impot-universel',
  imports: [NgTemplateOutlet],
  templateUrl: './impot-universel.html',
  styleUrl: './impot-universel.scss',
})
export class ImpotUniversel {
  private http = inject(HttpClient);
  private card = viewChild<ElementRef<HTMLElement>>('card');

  protected steps = STEPS;
  protected keys = KEYS;
  protected FR_RATE = FR_RATE;
  protected THRESHOLD = THRESHOLD;
  protected LEVEL_LOW = LEVEL_LOW;
  protected LEVEL_HIGH = LEVEL_HIGH;
  protected REF_INCOME = REF_INCOME;
  protected LEVEL_LABEL = LEVEL_LABEL;
  protected SOURCE_REPO = SOURCE_REPO;
  protected SOURCE_SITE = SOURCE_SITE;
  protected fmtRate = fmtRate;
  protected fmtRateD = fmtRateD;
  protected stateLabels = { met: 'Remplie', unmet: 'Non remplie', unknown: 'À vérifier', skipped: 'Non évaluée' };

  // ---------- Données ----------
  protected data = signal<Record<string, CountryData> | null>(null);
  protected dataError = signal(false);

  private regionNames = (() => {
    try {
      return new Intl.DisplayNames(['fr'], { type: 'region' });
    } catch {
      return null;
    }
  })();

  protected countries = COUNTRY_CODES.map((code) => ({ code, name: this.countryName(code) })).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr'),
  );

  constructor() {
    this.http.get<Record<string, CountryData>>(DATA_URL).subscribe({
      next: (d) => this.data.set(d),
      error: () => this.dataError.set(true),
    });

    // Page pas encore ouverte au public : on demande aux moteurs de ne pas l'indexer.
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    inject(DestroyRef).onDestroy(() => meta.removeTag("name='robots'"));
  }

  protected countryName(code: string): string {
    return NAME_OVERRIDES[code] ?? this.regionNames?.of(code) ?? code;
  }

  // ---------- Questionnaire ----------
  protected screen = signal<Screen>({ kind: 'start' });
  protected answers = signal<Answer[]>([]);
  /** Pays choisi à la dernière question. */
  protected country = signal<string | null>(null);

  protected progress = computed(() => {
    const s = this.screen();
    const done = s.kind === 'start' ? 0 : s.kind === 'step' ? s.i : STEPS.length;
    return Math.round((100 * done) / STEPS.length);
  });

  protected result = computed(() => evaluate(this.answers()));

  protected verdict = computed(() => {
    const r = this.result();
    const code = this.country();
    const d = code ? this.data()?.[code] : undefined;
    if (r.verdict === 'no') {
      let reason = r.reason ?? '';
      if (this.answers()[4] === 'no' && code && d) {
        reason = `pays de résidence choisi : ${this.countryName(code)}. Son taux effectif d'impôt sur le revenu, estimé à ${fmtRate(d.rate)}, dépasse le seuil de ${fmtRate(THRESHOLD)}.`;
      }
      return {
        cls: 'no',
        badge: 'Non concerné·e',
        title: 'Vous ne seriez pas concerné·e.',
        body: `Raison : ${reason} Il faut remplir toutes les conditions à la fois.`,
      };
    }
    if (r.verdict === 'maybe') {
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
  });

  /** Encadré du pays choisi, affiché quand le questionnaire est allé jusqu'au bout. */
  protected countryBox = computed(() => {
    const code = this.country();
    if (!code || this.answers().length < STEPS.length) return null;
    const d = this.data()?.[code];
    const level = levelOf(d);
    return {
      code,
      name: this.countryName(code),
      d,
      level,
      comment: d ? LEVEL_COMMENT[level] : UNRATED_COMMENT,
      unavailable: !d && this.dataError(),
    };
  });

  protected start() {
    this.answers.set([]);
    this.country.set(null);
    this.go({ kind: 'step', i: 0 });
  }

  protected restart() {
    this.answers.set([]);
    this.country.set(null);
    this.go({ kind: 'start' });
  }

  protected back(i: number) {
    this.answers.update((a) => a.slice(0, i - 1));
    this.go({ kind: 'step', i: i - 1 });
  }

  protected choose(i: number, value: Answer, code: string | null = null) {
    const answers = [...this.answers().slice(0, i), value];
    this.answers.set(answers);
    if (i === STEPS.length - 1) this.country.set(code);
    const r = evaluate(answers);
    this.go(r.verdict === 'incomplete' ? { kind: 'step', i: i + 1 } : { kind: 'result' });
  }

  private go(s: Screen) {
    this.screen.set(s);
    this.query.set('');
    this.active.set(-1);
    // Après le rendu : focus sur le titre de l'écran (ou le champ pays), et carte visible à l'écran.
    setTimeout(() => {
      const card = this.card()?.nativeElement;
      if (!card) return;
      const target = card.querySelector<HTMLElement>('#country-input') ?? card.querySelector<HTMLElement>('h2');
      target?.focus({ preventScroll: true });
      const top = card.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.4) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ---------- Sélecteur de pays ----------
  protected query = signal('');
  protected active = signal(-1);
  protected shown = computed(() => {
    const q = normalize(this.query());
    return q ? this.countries.filter((c) => normalize(c.name).includes(q)) : this.countries;
  });

  protected onQuery(v: string) {
    this.query.set(v);
    this.active.set(-1);
  }

  protected pick(code: string, i: number) {
    this.choose(i, answerOf(levelOf(this.data()?.[code])), code);
  }

  protected onPickerKey(e: KeyboardEvent, i: number) {
    const n = this.shown().length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (n) this.active.update((a) => Math.min(a + 1, n - 1));
      this.scrollActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) this.active.update((a) => Math.max(a - 1, 0));
      this.scrollActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const a = this.active();
      if (a >= 0) this.pick(this.shown()[a].code, i);
      else if (n === 1) this.pick(this.shown()[0].code, i);
    }
  }

  private scrollActive() {
    setTimeout(() => this.card()?.nativeElement.querySelector('.picker-item.active')?.scrollIntoView({ block: 'nearest' }));
  }

  /** Raccourcis clavier : A/B/C pour répondre, Entrée pour commencer ou recommencer. */
  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const card = this.card()?.nativeElement;
    // Les raccourcis ne valent que si le questionnaire est à l'écran.
    if (!card) return;
    const r = card.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const onControl = t && (t.tagName === 'A' || t.tagName === 'BUTTON' || t.tagName === 'SUMMARY');
    const s = this.screen();
    if (e.key === 'Enter' && !onControl && s.kind !== 'step') {
      e.preventDefault();
      if (s.kind === 'start') this.start();
      else this.restart();
      return;
    }
    if (s.kind !== 'step') return;
    const idx = KEYS.indexOf(e.key.toUpperCase());
    const opts = STEPS[s.i].options;
    if (idx >= 0 && idx < opts.length) {
      e.preventDefault();
      this.choose(s.i, opts[idx][1]);
    }
  }

  // ---------- Jauge ----------
  protected pos(rate: number): number {
    return Math.min(100, Math.max(0, (rate / GAUGE_MAX) * 100));
  }

  // ---------- Tableau des pays ----------
  protected continents = Object.entries(CONTINENTS);
  protected search = signal('');
  protected continentFilter = signal<string>('');
  protected levelFilter = signal<Level | ''>('');
  protected sortKey = signal<SortKey>('pays');
  protected sortAsc = signal(true);

  protected rows = computed(() => {
    const data = this.data();
    if (!data) return [];
    return Object.entries(data).map(([code, d]) => ({
      code,
      d,
      name: this.countryName(code) || d.nom,
      continent: CONTINENTS[d.continent] ?? '',
      level: levelOf(d),
    }));
  });

  protected counts = computed(() => {
    const c: Record<Level, number> = { below: 0, debatable: 0, above: 0 };
    for (const r of this.rows()) c[r.level]++;
    return c;
  });

  protected filteredRows = computed(() => {
    const q = normalize(this.search());
    const cont = this.continentFilter();
    const lvl = this.levelFilter();
    const key = this.sortKey();
    const dir = this.sortAsc() ? 1 : -1;
    return this.rows()
      .filter((r) => (!cont || r.d.continent === cont) && (!lvl || r.level === lvl))
      .filter((r) => !q || normalize(`${r.name} ${r.d.nom} ${r.continent} ${r.d.note}`).includes(q))
      .sort((a, b) => dir * (key === 'rate' ? a.d.rate - b.d.rate : a.name.localeCompare(b.name, 'fr')));
  });

  protected sortBy(key: SortKey) {
    if (this.sortKey() === key) this.sortAsc.update((v) => !v);
    else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
  }

  protected ariaSort(key: SortKey) {
    return this.sortKey() === key ? (this.sortAsc() ? 'ascending' : 'descending') : 'none';
  }

  protected adjustments(d: CountryData) {
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

  protected num(n: number): string {
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }
}
