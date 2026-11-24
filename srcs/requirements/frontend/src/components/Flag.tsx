import { useId } from 'react';
import { LANGS } from '../lib/i18n';
import type { Lang } from '../lib/i18n';

/**
 * Drapeau d'une langue du site (France, Royaume-Uni, Allemagne), dessiné en SVG : il s'affiche partout, contrairement
 * aux drapeaux en emoji (Windows affiche les lettres « FR »). Format 3:2, coins légèrement arrondis.
 */
export function Flag({ lang, className = 'h-4 w-6' }: { lang: Lang; className?: string }) {
  const id = useId();
  const box = `block shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,.15)] ${className}`;
  if (lang === 'fr') {
    return (
      <svg className={box} viewBox="0 0 3 2" aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <rect width="1" height="2" fill="#002395" />
        <rect x="1" width="1" height="2" fill="#fff" />
        <rect x="2" width="1" height="2" fill="#ed2939" />
      </svg>
    );
  }
  if (lang === 'de') {
    return (
      <svg className={box} viewBox="0 0 5 3" aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <rect width="5" height="1" fill="#000" />
        <rect y="1" width="5" height="1" fill="#dd0000" />
        <rect y="2" width="5" height="1" fill="#ffce00" />
      </svg>
    );
  }
  // Royaume-Uni (Union Jack), recadré au format 3:2
  return (
    <svg className={box} viewBox="0 0 60 30" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <clipPath id={`${id}-t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}-t)`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

/** Nombre de visites par langue, avec les drapeaux : « 🇫🇷 3  🇬🇧 0  🇩🇪 1 » (nom de la langue au survol). */
export function LangCounts({ counts, format = String }: { counts: Record<Lang, number>; format?: (n: number) => string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle">
      {LANGS.map((l) => (
        <span key={l.code} className="inline-flex items-center gap-1.5" title={`${l.label} : ${format(counts[l.code])}`}>
          <Flag lang={l.code} className="h-[12px] w-[18px]" />
          <span className="font-bold tabular-nums">{format(counts[l.code])}</span>
          <span className="visually-hidden"> ({l.label})</span>
        </span>
      ))}
    </span>
  );
}
