import { Injectable, computed, effect, signal } from '@angular/core';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { fr } from '../i18n/fr';
import type { Dict } from '../i18n/fr';

/**
 * Langues du site. Par défaut : la première langue du navigateur parmi celles-ci (sinon le français) ;
 * le choix fait dans le menu des langues est ensuite mémorisé dans le navigateur.
 *
 * Usage dans un composant :
 *   protected i18n = inject(I18n);
 *   {{ i18n.d().home.title }}                       → texte traduit (clés vérifiées à la compilation)
 *   {{ i18n.f(i18n.d().home.seeN, { n: 12 }) }}      → texte avec paramètres {n}
 * Les lectures de signaux dans les templates suffisent : la page se met à jour au changement de langue.
 */
export type Lang = 'fr' | 'en' | 'de';

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
];

const DICTS: Record<Lang, Dict> = { fr, en, de };
const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE' };
const STORAGE_KEY = 'lang';

function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'fr' || v === 'en' || v === 'de' ? v : null;
  } catch {
    return null;
  }
}

/** Langue du navigateur (en-tête Accept-Language) : première de la liste qui est proposée par le site. */
export function browserLang(): Lang {
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of prefs) {
    const code = (tag || '').slice(0, 2).toLowerCase();
    if (code === 'fr' || code === 'en' || code === 'de') return code;
  }
  return 'fr';
}

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<Lang>(storedLang() ?? browserLang());
  /** Dictionnaire de la langue courante. */
  readonly d = computed(() => DICTS[this.lang()]);
  /** Locale pour les dates et nombres (fr-FR, en-GB, de-DE). */
  readonly locale = computed(() => LOCALES[this.lang()]);

  private regions = computed(() => new Intl.DisplayNames([this.locale()], { type: 'region' }));

  constructor() {
    // Attribut lang de la page (lecteurs d'écran, césure, traduction automatique)
    effect(() => {
      if (typeof document !== 'undefined') document.documentElement.lang = this.lang();
    });
  }

  set(lang: Lang) {
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* stockage indisponible (navigation privée) : le choix vaut pour la visite en cours */
    }
  }

  /** Remplace les {paramètres} d'un texte traduit. */
  f(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
  }

  /** Nom d'un pays dans la langue courante, d'après son code ISO (XK = Kosovo). */
  country(code: string): string {
    if (code === 'XX') return this.d().common.otherCountry;
    try {
      return this.regions().of(code) ?? code;
    } catch {
      return code;
    }
  }

  /** Nom d'une ville renvoyée par le serveur (en français) dans la langue courante. */
  city(name: string): string {
    return this.d().cities[name as keyof Dict['cities']] ?? name;
  }

  date(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
    const date = typeof iso === 'string' ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso) : iso;
    return date.toLocaleDateString(this.locale(), opts);
  }

  number(n: number) {
    return n.toLocaleString(this.locale(), { maximumFractionDigits: 0 });
  }

  /** Comparaison de textes pour un tri alphabétique dans la langue courante. */
  compare(a: string, b: string) {
    return a.localeCompare(b, this.lang());
  }
}
