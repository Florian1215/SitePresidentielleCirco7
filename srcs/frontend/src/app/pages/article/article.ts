import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { Article } from '../../core/models';

@Component({
  selector: 'app-article',
  imports: [RouterLink, DatePipe],
  template: `
    @if (article(); as a) {
      <article>
        <header class="art-hero" [class.has-cover]="a.cover_image">
          @if (a.cover_image) {
            <div class="art-cover" aria-hidden="true">
              <img class="art-cover-img" [src]="a.cover_image" alt="" fetchpriority="high" />
            </div>
          }
          <div class="container container-narrow art-head">
            <a routerLink="/blog" class="back">← Toutes les actualités</a>
            <div class="meta">
              @if (a.status === 'draft') { <span class="badge badge-draft">Brouillon — non publié</span> }
              @if (a.category_detail) {
                <a class="badge" routerLink="/blog" [queryParams]="{ category: a.category_detail.slug }">{{ a.category_detail.name }}</a>
              }
            </div>
            <h1 class="art-title">{{ a.title }}</h1>
            @if (a.excerpt) { <p class="lead">{{ a.excerpt }}</p> }
            <p class="muted byline">
              Par <strong>{{ a.author_name }}</strong>
              @if (a.published_at) { · {{ a.published_at | date: 'd MMMM y' }} }
            </p>
            @if (a.can_edit || a.can_delete) {
              <div class="btn-row">
                @if (a.can_edit) { <a [routerLink]="['/blog', a.slug, 'modifier']" class="btn btn-sm">Modifier</a> }
                @if (a.can_delete) {
                  @if (confirming()) {
                    <span class="confirm">Supprimer définitivement ?</span>
                    <button type="button" class="btn btn-rouge btn-sm" (click)="remove(a.slug)">Oui, supprimer</button>
                    <button type="button" class="btn btn-outline btn-sm" (click)="confirming.set(false)">Annuler</button>
                  } @else {
                    <button type="button" class="btn btn-outline btn-sm" (click)="confirming.set(true)">Supprimer</button>
                  }
                }
              </div>
              @if (actionError()) { <div class="alert alert-err">{{ actionError() }}</div> }
            }
          </div>
        </header>
        <div class="section-sm art-body">
          <div class="container container-narrow">
            <div class="prose" [innerHTML]="html()"></div>
          </div>
        </div>
      </article>
    } @else if (notFound()) {
      <section class="section">
        <div class="container container-narrow">
          <h1 class="h2">Article introuvable</h1>
          <p>Cet article n'existe pas ou n'est pas encore publié.</p>
          <a routerLink="/blog" class="btn">Retour aux actualités</a>
        </div>
      </section>
    } @else {
      <p class="loader">Chargement…</p>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 20px; font-weight: 700; text-decoration: none; }
    .meta { display: flex; gap: 8px; margin-bottom: 12px; }
    .meta a { text-decoration: none; }
    .byline { margin-bottom: 20px; }
    .confirm { align-self: center; font-weight: 700; color: var(--rouge); }
    .alert { margin-top: 12px; }

    /* En-tête : sans image, simple bandeau ; avec image, l'image en fond qui se fond vers le texte */
    .art-hero { position: relative; padding: clamp(48px, 7vw, 88px) 0 clamp(24px, 4vw, 40px); }
    .art-head { position: relative; z-index: 1; }
    /* --cover-h : hauteur de l'image de couverture */
    .art-hero.has-cover {
      --cover-h: clamp(380px, 58vw, 760px);
      // Le titre se pose sur le bas de l'image, là où elle s'efface vers le fond
      padding-top: calc(var(--cover-h) - 110px);
    }
    .art-cover {
      position: absolute;
      inset: 0 0 auto 0;
      height: var(--cover-h);
      overflow: hidden;
      // Légère ombre en haut (bouton retour) et fondu vers le fond crème en bas
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(33, 35, 32, .3) 0, rgba(33, 35, 32, 0) 120px),
          linear-gradient(180deg, rgba(255, 252, 244, 0) 70%, rgba(255, 252, 244, .85) 90%, var(--creme) 100%);
      }
    }
    .art-cover-img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 50% 50%; // image centrée
    }
    .has-cover .back {
      position: absolute;
      top: calc(-1 * var(--cover-h) + 110px + 28px); // 28 px sous le haut de l'image
      background: rgba(255, 252, 244, .92);
      padding: 6px 12px;
      border-radius: 999px;
    }
    .art-title { font-size: clamp(36px, 6vw, 64px); line-height: 1.05; }
    // Le texte passe au-dessus du reflet, qui peut descendre plus bas que l'en-tête
    .art-body { position: relative; z-index: 1; padding-top: 8px; }
  `,
})
export class ArticlePage {
  readonly slug = input.required<string>();

  private api = inject(ApiService);
  private router = inject(Router);
  private title = inject(Title);

  protected article = signal<Article | null>(null);
  protected notFound = signal(false);
  protected confirming = signal(false);
  protected actionError = signal('');
  private sanitizer = inject(DomSanitizer);
  // Le contenu est nettoyé par le serveur à chaque enregistrement (backend : blog/sanitize.py, liste blanche
  // de balises). On l'affiche tel quel pour garder l'alignement (classes) et les vidéos intégrées (iframes).
  protected html = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.article()?.content ?? ''));

  constructor() {
    effect((onCleanup) => {
      const slug = this.slug();
      this.article.set(null);
      this.notFound.set(false);
      const sub = this.api.article(slug).subscribe({
        next: (a) => {
          this.article.set(a);
          this.title.setTitle(`${a.title} — LFI 7e circonscription`);
        },
        error: () => this.notFound.set(true),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  remove(slug: string) {
    this.api.deleteArticle(slug).subscribe({
      next: () => this.router.navigateByUrl('/blog'),
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }
}
