import { request } from './api';
import { langStore } from './i18n';
import type { Lang } from './i18n';

/**
 * Comptage des visites (page « Trackers »).
 *
 * Une visite est comptée à l'arrivée sur le site : une fois par onglet, et à chaque arrivée par un lien de suivi
 * (`https://site/?lang=fr&t=<identifiant>`). Le serveur en déduit l'origine (Google, ChatGPT, Facebook…) d'après
 * la page précédente (`document.referrer`) ou le paramètre `utm_source` que certains sites ajoutent à leurs liens.
 * `t` et les paramètres `utm_*` sont ensuite retirés de l'adresse : un rechargement ou un partage ne recompte pas.
 */
export const TRACKER_PARAM = 't';
const SESSION_KEY = 'lfi7.visit';

/** Lien de suivi d'un tracker, dans une langue. */
export function trackerUrl(code: string, lang: Lang): string {
  return `${window.location.origin}/?lang=${lang}&${TRACKER_PARAM}=${encodeURIComponent(code)}`;
}

function alreadyCounted(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return true;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* stockage indisponible (navigation privée stricte) : chaque chargement compte */
  }
  return false;
}

/**
 * Visite de la page d'un groupe d'action : comptée une fois par onglet et par groupe (panneau « QR code » de la page).
 * Les membres du groupe ne sont pas comptés (le serveur les reconnaît à leur connexion).
 */
export function recordGroupVisit(groupId: number) {
  const key = `lfi7.group-visit.${groupId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* stockage indisponible : chaque affichage compte */
  }
  let referrer = '';
  try {
    if (document.referrer && new URL(document.referrer).origin !== location.origin) referrer = document.referrer;
  } catch {
    /* adresse d'origine illisible : accès direct */
  }
  request(`/api/action-groups/${groupId}/visit/`, { method: 'POST', body: { lang: langStore.get(), referrer } }).catch(() => {
    /* visite non comptée : sans conséquence */
  });
}

/** À appeler au démarrage, avant `initLang()` (qui retire `?lang=` de l'adresse). */
export function recordVisit() {
  const url = new URL(location.href);
  const code = url.searchParams.get(TRACKER_PARAM)?.trim() ?? '';
  const utmSource = url.searchParams.get('utm_source')?.trim() ?? '';

  const tracked = [...url.searchParams.keys()].filter((k) => k === TRACKER_PARAM || k.startsWith('utm_'));
  if (tracked.length) {
    tracked.forEach((k) => url.searchParams.delete(k));
    history.replaceState(history.state, '', url.href);
  }

  // Déjà comptée dans cet onglet, sauf nouvelle arrivée par un lien de suivi
  if (alreadyCounted() && !code) return;

  let referrer = '';
  try {
    if (document.referrer && new URL(document.referrer).origin !== location.origin) referrer = document.referrer;
  } catch {
    /* adresse d'origine illisible : accès direct */
  }

  const fromUrl = url.searchParams.get('lang')?.trim().slice(0, 2).toLowerCase();
  const lang = fromUrl === 'fr' || fromUrl === 'en' || fromUrl === 'de' ? fromUrl : langStore.get();
  request('/api/track/', { method: 'POST', body: { code, lang, referrer, utm_source: utmSource } }).catch(() => {
    /* visite non comptée : sans conséquence pour la personne */
  });
}
