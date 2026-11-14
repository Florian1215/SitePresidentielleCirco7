/**
 * Toutes les informations de campagne modifiables à un seul endroit.
 * ⚠️ Les dates de l'élection et la date limite d'inscription sont à vérifier
 * dès la publication du décret de convocation des électeur·ices.
 */
export const CAMPAIGN = {
  circo: '7e circonscription des Français·es établi·es hors de France',
  circoShort: '7e circo',
  zone: "Allemagne, Europe centrale et Balkans",

  election: {
    // Dates indicatives (à confirmer par décret)
    firstRound: '2027-04-18',
    secondRound: '2027-05-02',
    // Règle : 6e vendredi avant le 1er tour au consulat, 6e mercredi en ligne
    registrationDeadlineOnline: '2027-03-10',
    registrationDeadlineConsulate: '2027-03-12',
    datesConfirmed: false,
  },

  contactEmail: 'contact@europe-insoumise.org',

  links: {
    registerOnline: 'https://www.service-public.gouv.fr/particuliers/vosdroits/R16396',
    checkSituation: 'https://www.elections.interieur.gouv.fr/mes-demarches/je-verifie-ma-situation-electorale',
    procuration: 'https://actionpopulaire.fr/procuration/',
    diplomatieElections: 'https://www.diplomatie.gouv.fr/fr/services-aux-francais/elections-a-l-etranger/',
    servicePublicElections: 'https://www.service-public.gouv.fr/particuliers/vosdroits/N47',
    programmeNational: 'https://melenchon2027.fr/',
    // Bouton « Je soutiens » : renvoie vers le site national de la candidature
    soutenir: 'https://melenchon2027.fr/',
    actionPopulaire: 'https://actionpopulaire.fr/',
  },

  // Sites amis et réseaux sociaux : à gérer dans l'admin Django (Gestion du site → Sites amis / Réseaux sociaux).
};

export interface Country {
  code: string;
  name: string;
  registered: number | null; // Français·es inscrit·es au registre (source : Wikipédia / MEAE) ; null si inconnu
  posts: string;
}

export const COUNTRIES: Country[] = [
  { code: 'DE', name: 'Allemagne', registered: 114372, posts: 'Berlin, Bonn, Düsseldorf, Francfort, Hambourg, Munich, Sarrebruck, Stuttgart' },
  { code: 'AT', name: 'Autriche', registered: 8024, posts: 'Vienne' },
  { code: 'PL', name: 'Pologne', registered: 5757, posts: 'Varsovie, Cracovie' },
  { code: 'CZ', name: 'Tchéquie', registered: 2983, posts: 'Prague' },
  { code: 'RO', name: 'Roumanie', registered: 2979, posts: 'Bucarest' },
  { code: 'HU', name: 'Hongrie', registered: 2413, posts: 'Budapest' },
  { code: 'RS', name: 'Serbie', registered: 1591, posts: 'Belgrade' },
  { code: 'BG', name: 'Bulgarie', registered: 1119, posts: 'Sofia' },
  { code: 'HR', name: 'Croatie', registered: 925, posts: 'Zagreb' },
  { code: 'SK', name: 'Slovaquie', registered: 895, posts: 'Bratislava' },
  { code: 'SI', name: 'Slovénie', registered: 682, posts: 'Ljubljana' },
  { code: 'BA', name: 'Bosnie-Herzégovine', registered: 318, posts: 'Sarajevo' },
  { code: 'MK', name: 'Macédoine du Nord', registered: 201, posts: 'Skopje' },
  { code: 'AL', name: 'Albanie', registered: 172, posts: 'Tirana' },
  { code: 'ME', name: 'Monténégro', registered: 111, posts: 'Podgorica' },
  { code: 'XK', name: 'Kosovo', registered: null, posts: 'Pristina' },
];

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', opts);
}

export function daysUntil(iso: string): number {
  const ms = new Date(iso + 'T08:00:00').getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
