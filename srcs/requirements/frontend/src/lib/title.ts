import { useEffect } from 'react';
import { useI18n } from './i18n';

/**
 * Titre d'onglet traduit : `key` est une clé de i18n `titles` (ex. 'home'), ou un texte fixe
 * pour les pages de l'espace rédaction. Le titre suit aussi les changements de langue.
 * `null` : la page gère son propre titre (article).
 */
export function usePageTitle(key: string | null) {
  const { d } = useI18n();
  useEffect(() => {
    if (!key) return;
    const titles = d.titles as Record<string, string>;
    document.title = key in titles ? `${titles[key]} — ${titles['suffix']}` : key;
  }, [key, d]);
}
