import { useI18n } from '../lib/i18n';

/**
 * Photos de campagne en WebP dans public/img/web : <fichier>-800.webp et <fichier>-1600.webp.
 * `widths` indique leurs largeurs réelles quand l'original est plus petit que 1600 px.
 */
interface PhotoDef {
  file: string;
  alt: string;
  /** Largeurs réelles des deux fichiers, si l'original fait moins de 1600 px. */
  widths?: readonly [number, number];
}

export const PHOTOS = {
  manifBerlin: { file: 'manif_berlin', alt: 'Militant·es insoumis·es avec pancartes et drapeaux devant le Reichstag, à Berlin' },
  interviewBerlin: { file: 'interview_berlin', alt: "Un militant insoumis interviewé lors d'un rassemblement à Berlin" },
  meetingLille: { file: 'meeting_lille', alt: 'Foule rassemblée pour un meeting de Jean-Luc Mélenchon à Lille' },
  melenchon: { file: 'melenchon', alt: 'Jean-Luc Mélenchon souriant au milieu de militant·es' },
  dedicasse: { file: 'melenchon_dedicasse', alt: 'Jean-Luc Mélenchon dédicace une affiche pour un jeune militant' },
  manif: { file: 'manif_melenchon', alt: 'Jean-Luc Mélenchon, le poing levé, en tête de cortège' },
  selfie: { file: 'photo_foule_melenchon', alt: 'Jean-Luc Mélenchon pose pour des selfies avec des sympathisant·es' },
  // Photos du groupe de Berlin
  berlinBrandebourg: { file: 'berlin_brandebourg', alt: 'Militant·es insoumis·es devant la porte de Brandebourg, avec des pancartes « Virage obligatoire à gauche » et « Taxez les riches »' },
  reunionPublique: { file: 'reunion_publique', alt: 'Réunion publique des insoumis·es à Berlin, le public assis face aux intervenant·es' },
  standLfi: { file: 'stand_lfi', alt: "Stand de La France insoumise lors d'une réunion publique : une militante accueille les participant·es" },
  equipeBerlin: { file: 'equipe_berlin', alt: "L'équipe militante applaudie par le public à la fin d'une réunion publique" },
  berlinFernsehturm: { file: 'berlin_fernsehturm', alt: 'Manifestation à Berlin au pied de la tour de télévision' },
  rassemblementPalestine: { file: 'rassemblement_palestine', alt: 'Rassemblement de solidarité avec la Palestine à Berlin' },
  voteAsma: { file: 'vote_asma', alt: "Asma glisse son bulletin dans l'urne, tout sourire", widths: [640, 960] },
} as const satisfies Record<string, PhotoDef>;

export type PhotoName = keyof typeof PHOTOS;

export function photoSrc(name: PhotoName, width: 800 | 1600 = 1600) {
  return `/img/web/${PHOTOS[name].file}-${width}.webp`;
}

interface Props {
  name: PhotoName;
  /** Classe du bloc (taille, proportions, coins arrondis), définie par la page. */
  className?: string;
  sizes?: string;
  caption?: string;
  position?: string;
  eager?: boolean;
  /** Remplace le texte alternatif par défaut ; '' pour une image décorative. */
  altText?: string;
}

export function Photo({ name, className, sizes = '100vw', caption, position, eager = false, altText }: Props) {
  const { d } = useI18n();
  const p: PhotoDef = PHOTOS[name];
  const [small, large] = p.widths ?? [800, 1600];
  // Texte alternatif dans la langue du site (i18n `photos`), le français de PHOTOS en secours
  const alt = altText ?? (d.photos as Record<string, string>)[name] ?? p.alt;
  return (
    <div className={className}>
      <figure className="group relative m-0 h-full overflow-hidden rounded-[inherit]">
        <img
          className="h-full w-full object-cover"
          src={photoSrc(name, 1600)}
          srcSet={`${photoSrc(name, 800)} ${small}w, ${photoSrc(name, 1600)} ${large}w`}
          sizes={sizes}
          alt={alt}
          loading={eager ? undefined : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          style={position ? { objectPosition: position } : undefined}
        />
        {caption && (
          <figcaption className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] translate-y-1 rounded bg-noir px-[9px] py-[5px] text-[12px] leading-[1.3] font-medium text-creme opacity-0 transition-[opacity,translate] duration-200 ease-[ease] group-hover:translate-y-0 group-hover:opacity-100">
            {caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
