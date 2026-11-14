import { useMemo } from 'react';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { fr } from '../i18n/fr';
import type { Dict } from '../i18n/fr';
import { createStore, useStore } from './store';

/**
 * Langues du site, par ordre de priorité :
 *   1. le paramètre d'URL ?lang=fr|en|de (ou ?lan=…), pratique pour partager un lien dans une langue ;
 *   2. le choix fait dans le menu des langues (mémorisé dans le navigateur) ;
 *   3. la première langue du navigateur parmi celles-ci (sinon le français).
 * Une langue passée dans l'URL est mémorisée, puis le paramètre est retiré de l'adresse.
 *
 * Usage dans un composant :
 *   const i18n = useI18n();
 *   {i18n.d.home.title}                        → texte traduit (clés vérifiées à la compilation)
 *   {i18n.f(i18n.d.home.seeN, { n: 12 })}       → texte avec paramètres {n}
 * Le composant se met à jour au changement de langue.
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
const URL_PARAMS = ['lang', 'lan'];

function isLang(v: string | null | undefined): v is Lang {
  return v === 'fr' || v === 'en' || v === 'de';
}

/** Retire ?lang=… / ?lan=… de la barre d'adresse une fois la langue prise en compte (sans recharger). */
function removeUrlLang() {
  const url = new URL(location.href);
  if (!URL_PARAMS.some((n) => url.searchParams.has(n))) return;
  URL_PARAMS.forEach((n) => url.searchParams.delete(n));
  history.replaceState(history.state, '', url.href);
}

/** Langue demandée dans l'URL (?lang=en ou ?lan=en), s'il y en a une valide. */
function urlLang(): Lang | null {
  const params = new URLSearchParams(location.search);
  for (const name of URL_PARAMS) {
    const v = params.get(name)?.trim().slice(0, 2).toLowerCase();
    if (isLang(v)) return v;
  }
  return null;
}

function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** Langue du navigateur (en-tête Accept-Language) : première de la liste qui est proposée par le site. */
export function browserLang(): Lang {
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of prefs) {
    const code = (tag || '').slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return 'fr';
}

/** Langue courante, lisible hors React (client API). */
export const langStore = createStore<Lang>(storedLang() ?? browserLang());

export function setLang(lang: Lang) {
  langStore.set(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* stockage indisponible (navigation privée) : le choix vaut pour la visite en cours */
  }
}

/** À appeler une fois au démarrage : langue de l'URL, attribut lang de la page. */
export function initLang() {
  const fromUrl = urlLang();
  if (fromUrl) setLang(fromUrl);
  removeUrlLang();
  // Attribut lang de la page (lecteurs d'écran, césure, traduction automatique)
  const apply = () => (document.documentElement.lang = langStore.get());
  apply();
  langStore.subscribe(apply);
}

export interface I18n {
  lang: Lang;
  /** Dictionnaire de la langue courante. */
  d: Dict;
  /** Locale pour les dates et nombres (fr-FR, en-GB, de-DE). */
  locale: string;
  set(lang: Lang): void;
  f(text: string, params: Record<string, string | number>): string;
  country(code: string): string;
  city(name: string): string;
  date(iso: string | Date, opts?: Intl.DateTimeFormatOptions): string;
  number(n: number): string;
  compare(a: string, b: string): number;
}

/** Remplace les {paramètres} d'un texte traduit. */
export function format(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

function makeI18n(lang: Lang): I18n {
  const d = DICTS[lang];
  const locale = LOCALES[lang];
  let regions: Intl.DisplayNames | null = null;
  return {
    lang,
    d,
    locale,
    set: setLang,
    f: format,
    /** Nom d'un pays dans la langue courante, d'après son code ISO (XK = Kosovo). */
    country(code) {
      if (code === 'XX') return d.common.otherCountry;
      try {
        regions ??= new Intl.DisplayNames([locale], { type: 'region' });
        return regions.of(code) ?? code;
      } catch {
        return code;
      }
    },
    /** Nom d'une ville renvoyée par le serveur (en français) dans la langue courante. */
    city(name) {
      return d.cities[name] ?? name;
    },
    date(iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
      const date = typeof iso === 'string' ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso) : iso;
      return date.toLocaleDateString(locale, opts);
    },
    number(n) {
      return n.toLocaleString(locale, { maximumFractionDigits: 0 });
    },
    /** Comparaison de textes pour un tri alphabétique dans la langue courante. */
    compare(a, b) {
      return a.localeCompare(b, lang);
    },
  };
}

export function useI18n(): I18n {
  const lang = useStore(langStore);
  return useMemo(() => makeI18n(lang), [lang]);
}
