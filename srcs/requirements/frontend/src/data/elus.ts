/**
 * Conseiller·ères des Français de l'étranger élu·es le 31 mai 2026 sur des listes soutenues
 * par La France insoumise, dans la 7e circonscription.
 * Source : résultats officiels des élections consulaires 2026 et https://consulaires-2026.europe-insoumise.org/
 * Portraits dans public/img/web/elus/<photo>.webp (200 × 200) ; sans photo, les initiales s'affichent.
 */
export type ElusZone = 'deNord' | 'autriche';

export interface Elu {
  name: string;
  zone: ElusZone;
  /** Élu·e aussi à l'Assemblée des Français de l'étranger. */
  afe?: boolean;
  photo?: string;
  email?: string;
}

export const ELUS: Elu[] = [
  {
    name: 'Asma Rharmaoui-Claquin',
    zone: 'deNord',
    afe: true,
    photo: 'asma-rharmaoui-claquin',
    email: 'a.rharmaoui-claquin@assemblee-afe.fr',
  },
  { name: 'Maxime Gautier', zone: 'deNord', afe: true, photo: 'maxime-gautier', email: 'm.gautier@assemblee-afe.fr' },
  { name: 'Étienne Leroy', zone: 'autriche', photo: 'etienne-leroy' },
];
