import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Article } from '../core/models';
import { PhotoName, photoSrc } from './photo';

/** Visuels par défaut des articles sans image : photos de mobilisation (pas de portraits individuels). */
const FALLBACKS: PhotoName[] = [
  'berlinBrandebourg', 'reunionPublique', 'manifBerlin', 'rassemblementPalestine',
  'equipeBerlin', 'interviewBerlin', 'berlinFernsehturm', 'meetingLille',
];

@Component({
  selector: 'app-article-card',
  imports: [RouterLink, DatePipe],
  template: `
    @let a = article();
    <a class="acard" [routerLink]="['/blog', a.slug]">
      <div class="acard-img">
        <img [src]="a.cover_image || fallback(a.id)" alt="" loading="lazy" decoding="async" />
      </div>
      <div class="acard-body">
        <div class="acard-meta">
          @if (a.status === 'draft') { <span class="badge badge-draft">Brouillon</span> }
          @if (a.category_detail) { <span class="badge">{{ a.category_detail.name }}</span> }
          <span class="date">{{ (a.published_at || a.created_at) | date: 'd MMMM y' }}</span>
        </div>
        <h3>{{ a.title }}</h3>
        @if (a.excerpt) { <p class="muted">{{ a.excerpt }}</p> }
        <span class="more">Lire la suite →</span>
      </div>
    </a>
  `,
  styles: `
    .acard { display: flex; flex-direction: column; height: 100%; background: #fff; border-radius: var(--radius); overflow: hidden; text-decoration: none; color: inherit; box-shadow: var(--shadow); transition: transform .15s; }
    .acard:hover { transform: translateY(-3px); }
    .acard-img { aspect-ratio: 16 / 9; background: var(--lavande); }
    .acard-img img { width: 100%; height: 100%; object-fit: cover; }
    .acard-body { padding: 20px 22px 24px; display: flex; flex-direction: column; flex: 1; }
    .acard-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
    .date { font-size: 13px; color: var(--texte); }
    h3 { font-size: 24px; margin-bottom: 8px; }
    p { font-size: 15px; }
    .more { margin-top: auto; font-weight: 700; color: var(--rouge); }
  `,
})
export class ArticleCard {
  readonly article = input.required<Article>();

  protected fallback(id: number) {
    return photoSrc(FALLBACKS[Math.abs(id) % FALLBACKS.length], 800);
  }
}
