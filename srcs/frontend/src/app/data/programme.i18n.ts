import { Injectable, computed, inject } from '@angular/core';
import { I18n, Lang } from '../core/i18n';
import { CATEGORIES, Category, URGENCES } from './programme.data';
import { PROGRAMME_DE } from './programme.de';
import { PROGRAMME_EN } from './programme.en';

/**
 * Textes traduits du programme. La structure (parties, couleurs, pictos, mesures phares) vient de
 * programme.data.ts (français, version de référence) ; les traductions ne contiennent que les textes,
 * dans le même ordre. Si une traduction manque, le texte français est affiché.
 */
export interface ProgrammeText {
  urgences: { title: string; text: string }[];
  categories: { title: string; intro: string; mesures: [title: string, text: string][] }[];
}

type Urgence = (typeof URGENCES)[number];

const TEXTS: Partial<Record<Lang, ProgrammeText>> = { en: PROGRAMME_EN, de: PROGRAMME_DE };

function localize(lang: Lang): { categories: Category[]; urgences: Urgence[] } {
  const t = TEXTS[lang];
  if (!t) return { categories: CATEGORIES, urgences: URGENCES };
  return {
    categories: CATEGORIES.map((cat, i) => {
      const tc = t.categories[i];
      return {
        ...cat,
        title: tc?.title ?? cat.title,
        intro: tc?.intro ?? cat.intro,
        mesures: cat.mesures.map((m, j) => {
          const tm = tc?.mesures[j];
          return { ...m, title: tm?.[0] ?? m.title, text: tm?.[1] ?? m.text };
        }),
      };
    }),
    urgences: URGENCES.map((u, i) => ({ ...u, title: t.urgences[i]?.title ?? u.title, text: t.urgences[i]?.text ?? u.text })),
  };
}

/** Le programme dans la langue courante (se met à jour au changement de langue). */
@Injectable({ providedIn: 'root' })
export class ProgrammeContent {
  private i18n = inject(I18n);
  private content = computed(() => localize(this.i18n.lang()));
  readonly categories = computed(() => this.content().categories);
  readonly urgences = computed(() => this.content().urgences);
}
