import { Component, computed, inject, input } from '@angular/core';
import { I18n } from '../core/i18n';

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
  interviewBerlin: { file: 'interview_berlin', alt: 'Un militant insoumis interviewé lors d\'un rassemblement à Berlin' },
  meetingLille: { file: 'meeting_lille', alt: 'Foule rassemblée pour un meeting de Jean-Luc Mélenchon à Lille' },
  melenchon: { file: 'melenchon', alt: 'Jean-Luc Mélenchon souriant au milieu de militant·es' },
  dedicasse: { file: 'melenchon_dedicasse', alt: 'Jean-Luc Mélenchon dédicace une affiche pour un jeune militant' },
  manif: { file: 'manif_melenchon', alt: 'Jean-Luc Mélenchon, le poing levé, en tête de cortège' },
  selfie: { file: 'photo_foule_melenchon', alt: 'Jean-Luc Mélenchon pose pour des selfies avec des sympathisant·es' },
  // Photos du groupe de Berlin
  berlinBrandebourg: { file: 'berlin_brandebourg', alt: 'Militant·es insoumis·es devant la porte de Brandebourg, avec des pancartes « Virage obligatoire à gauche » et « Taxez les riches »' },
  reunionPublique: { file: 'reunion_publique', alt: 'Réunion publique des insoumis·es à Berlin, le public assis face aux intervenant·es' },
  standLfi: { file: 'stand_lfi', alt: 'Stand de La France insoumise lors d\'une réunion publique : une militante accueille les participant·es' },
  equipeBerlin: { file: 'equipe_berlin', alt: 'L\'équipe militante applaudie par le public à la fin d\'une réunion publique' },
  berlinFernsehturm: { file: 'berlin_fernsehturm', alt: 'Manifestation à Berlin au pied de la tour de télévision' },
  rassemblementPalestine: { file: 'rassemblement_palestine', alt: 'Rassemblement de solidarité avec la Palestine à Berlin' },
  voteAsma: { file: 'vote_asma', alt: 'Asma glisse son bulletin dans l\'urne, tout sourire', widths: [640, 960] },
} as const satisfies Record<string, PhotoDef>;

export type PhotoName = keyof typeof PHOTOS;

export function photoSrc(name: PhotoName, width: 800 | 1600 = 1600) {
  return `img/web/${PHOTOS[name].file}-${width}.webp`;
}

@Component({
  selector: 'app-photo',
  template: `
    <figure [class.has-caption]="caption()">
      <img
        [src]="src()"
        [attr.srcset]="srcset()"
        [attr.sizes]="sizes()"
        [alt]="alt()"
        [attr.loading]="eager() ? null : 'lazy'"
        [attr.fetchpriority]="eager() ? 'high' : null"
        decoding="async"
        [style.object-position]="position()"
      />
      @if (caption()) {
        <figcaption>{{ caption() }}</figcaption>
      }
    </figure>
  `,
  styles: `
    :host { display: block; }
    :host(.caption-top) figcaption { top: 12px; bottom: auto; }
    figure { position: relative; margin: 0; height: 100%; overflow: hidden; border-radius: inherit; }
    img { width: 100%; height: 100%; object-fit: cover; }
    figcaption {
      position: absolute; left: 12px; bottom: 12px;
      background: var(--noir); color: var(--creme);
      font-size: 12px; font-weight: 500; line-height: 1.3;
      padding: 5px 9px; border-radius: 4px; max-width: calc(100% - 24px);
      opacity: 0; transform: translateY(4px); transition: opacity .2s, transform .2s;
    }
    figure:hover figcaption { opacity: 1; transform: none; }
  `,
})
export class Photo {
  readonly name = input.required<PhotoName>();
  readonly sizes = input('100vw');
  readonly caption = input<string>();
  readonly position = input<string>();
  readonly eager = input(false);
  /** Remplace le texte alternatif par défaut ; '' pour une image décorative. */
  readonly altText = input<string>();

  protected src = computed(() => photoSrc(this.name(), 1600));
  protected srcset = computed(() => {
    const p: PhotoDef = PHOTOS[this.name()];
    const [small, large] = p.widths ?? [800, 1600];
    return `${photoSrc(this.name(), 800)} ${small}w, ${photoSrc(this.name(), 1600)} ${large}w`;
  });
  private i18n = inject(I18n);
  /** Texte alternatif dans la langue du site (i18n `photos`), le français de PHOTOS en secours. */
  protected alt = computed(() => this.altText() ?? (this.i18n.d().photos as Record<string, string>)[this.name()] ?? PHOTOS[this.name()].alt);
}
