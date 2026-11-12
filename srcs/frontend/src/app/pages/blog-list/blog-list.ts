import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Article, Category } from '../../core/models';
import { ArticleCard } from '../../shared/article-card';
import { EventCard } from '../../shared/event-card';
import { toSignal } from '@angular/core/rxjs-interop';
import { Photo } from '../../shared/photo';
import { I18n } from '../../core/i18n';

@Component({
  selector: 'app-blog-list',
  imports: [RouterLink, ArticleCard, EventCard, Photo],
  template: `
    <section class="page-hero">
      <div class="container head">
        <div>
          @let t = i18n.d().blog;
          <span class="eyebrow">{{ t.eyebrow }}</span>
          <h1>{{ mine() ? t.mine : t.title }}</h1>
          <p class="lead">{{ t.lead }}</p>
          @if (!mine()) {
            <div class="btn-row hero-links">
              <a routerLink="." fragment="agenda" class="btn">{{ t.seeAgenda }}</a>
              <a routerLink="." fragment="articles" class="btn btn-outline">{{ t.readArticles }}</a>
            </div>
          }
          @if (auth.canWrite()) {
            <a routerLink="/blog/ecrire" class="btn btn-rouge write">{{ t.write }}</a>
          }
        </div>
        <app-photo class="head-photo" name="reunionPublique" sizes="(max-width: 900px) 100vw, 460px" [caption]="i18n.d().blog.photoCaption" position="50% 40%" [eager]="true" />
      </div>
    </section>

    <!-- AGENDA (calendrier Zetkin) -->
    @if (!mine()) {
      <section class="section bg-lavande" id="agenda">
        <div class="container">
          <!-- Titre à gauche, tags des villes à droite -->
          <div class="agenda-head">
            <h2>{{ i18n.d().blog.agendaTitle }}</h2>
          @if (cities().length > 1) {
            <div class="cats city-filter" role="group" [attr.aria-label]="i18n.d().blog.cityFilterAria">
              <button type="button" class="chip" [class.on]="!city()" [attr.aria-pressed]="!city()" (click)="city.set(null)">{{ i18n.d().blog.allCities }}</button>
              @for (c of cities(); track c.name) {
                <button type="button" class="chip" [class.on]="city() === c.name" [attr.aria-pressed]="city() === c.name" (click)="city.set(c.name)">
                  {{ i18n.city(c.name) }} <span class="chip-count">{{ c.count }}</span>
                </button>
              }
            </div>
          }
          </div>
          @if (events() === undefined) {
            <p class="loader">{{ i18n.d().blog.loadingAgenda }}</p>
          } @else if (!events()!.length) {
            <p class="muted">{{ i18n.d().blog.noEvents }}</p>
          } @else {
            <ul class="events grid grid-3">
              @for (e of visibleEvents(); track e.id) {
                <li><app-event-card [event]="e" /></li>
              }
            </ul>
            @if (filteredEvents().length > eventsShown) {
              <div class="more-events">
                <button type="button" class="btn btn-outline" (click)="allEvents.set(!allEvents())">
                  {{ allEvents() ? i18n.d().blog.showLess : i18n.f(i18n.d().blog.showMore, { n: filteredEvents().length - eventsShown }) }}
                </button>
              </div>
            }
          }
        </div>
      </section>
    }

    <!-- ARTICLES -->
    <section class="section" id="articles">
      <div class="container">
        @if (!mine()) {
          <div class="section-head">
            <span class="eyebrow">{{ i18n.d().blog.blogEyebrow }}</span>
            <h2>{{ i18n.d().blog.articlesTitle }}</h2>
          </div>
        }
        <div class="filters">
          <form class="search" (submit)="$event.preventDefault(); go({ search: searchBox.value || null, page: null })" role="search">
            <label for="blog-search" class="visually-hidden">{{ i18n.d().blog.search }}</label>
            <input #searchBox id="blog-search" type="search" [placeholder]="i18n.d().blog.searchPlaceholder" [value]="search() ?? ''" />
            <button class="btn btn-sm" type="submit">{{ i18n.d().blog.search }}</button>
          </form>
          <div class="cats">
            @if (shownCategories().length) {
              <button type="button" class="chip" [class.on]="!selectedCategory()" [attr.aria-pressed]="!selectedCategory()" (click)="selectedCategory.set(null)">{{ i18n.d().blog.allCategories }}</button>
              @for (c of shownCategories(); track c.id) {
                <button type="button" class="chip" [class.on]="selectedCategory() === c.slug" [attr.aria-pressed]="selectedCategory() === c.slug" (click)="selectedCategory.set(c.slug)">{{ c.name }}</button>
              }
            }
            @if (auth.canWrite()) {
              <button type="button" class="chip chip-alt" [class.on]="!!mine()" (click)="go({ mine: mine() ? null : 1, page: null })">{{ i18n.d().blog.mine }}</button>
            }
          </div>
        </div>

        @if (loading()) {
          <p class="loader">{{ i18n.d().blog.loading }}</p>
        } @else if (error()) {
          <div class="alert alert-err">{{ i18n.d().blog.loadError }}</div>
        } @else if (!articles().length) {
          <p class="loader">{{ i18n.d().blog.noArticles }}</p>
        } @else {
          <div class="grid grid-3">
            @for (a of shownArticles(); track a.id) {
              <app-article-card [article]="a" />
            }
          </div>
          @if (pages() > 1) {
            <nav class="pager" [attr.aria-label]="i18n.d().blog.pagination">
              <button type="button" class="btn btn-outline btn-sm" [disabled]="pageNum() <= 1" (click)="go({ page: pageNum() - 1 })">{{ i18n.d().blog.prev }}</button>
              <span>{{ i18n.f(i18n.d().blog.page, { n: pageNum(), total: pages() }) }}</span>
              <button type="button" class="btn btn-outline btn-sm" [disabled]="pageNum() >= pages()" (click)="go({ page: pageNum() + 1 })">{{ i18n.d().blog.next }}</button>
            </nav>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .head { display: grid; grid-template-columns: 1.3fr 1fr; align-items: center; gap: 40px; }
    .head-photo { aspect-ratio: 4 / 3; border-radius: var(--radius); overflow: hidden; }
    .hero-links { margin-top: 8px; }
    .write { margin-top: 16px; }
    .events { list-style: none; margin: 0; padding: 0; }
    .more-events { display: flex; justify-content: center; margin-top: 28px; }
    .agenda-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px 32px;
      margin-bottom: clamp(28px, 4vw, 44px);
      h2 { margin: 0; }
    }
    .city-filter { justify-content: flex-end; }
    @media (max-width: 900px) { .city-filter { justify-content: flex-start; } } // sous le titre sur petit écran
    .city-filter .chip { background: #fff; }
    .city-filter .chip.on { background: var(--violet); }
    .chip-count { margin-left: 4px; font-size: 12px; opacity: .7; }
    #agenda, #articles { scroll-margin-top: 80px; }
    @media (max-width: 900px) { .head { grid-template-columns: 1fr; } }
    .filters { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
    .search { display: flex; gap: 8px; flex: 1 1 320px; max-width: 480px; }
    .search input { padding: 10px 14px; }
    .cats { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .chip { border: 2px solid var(--violet); background: transparent; color: var(--violet); border-radius: 999px; padding: 6px 14px; font: inherit; font-weight: 700; font-size: 14px; cursor: pointer; }
    .chip.on { background: var(--violet); color: var(--creme); }
    .chip-alt { border-color: var(--rouge); color: var(--rouge); }
    .chip-alt.on { background: var(--rouge); color: var(--creme); }
    .pager { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 40px; font-weight: 700; }
  `,
})
export class BlogList {
  // Paramètres d'URL (?page=&search=&mine=) ; ?category= présélectionne seulement un filtre
  readonly page = input<string>();
  readonly search = input<string>();
  readonly category = input<string>();
  readonly mine = input<string>();

  protected auth = inject(AuthService);
  protected i18n = inject(I18n);
  private api = inject(ApiService);
  private router = inject(Router);

  // Agenda : les premiers rendez-vous, puis tout l'agenda sur demande
  // 3 cartes par ligne, 3 lignes
  protected readonly eventsShown = 9;
  protected events = toSignal(this.api.events());
  protected allEvents = signal(false);
  /** Filtre par ville, appliqué sur place (sans recharger la page). */
  protected city = signal<string | null>(null);
  /** Villes des rendez-vous à venir, de la plus active à la moins active ; « En ligne » en dernier. */
  protected cities = computed(() => {
    const counts = new Map<string, number>();
    for (const e of this.events() ?? []) if (e.city) counts.set(e.city, (counts.get(e.city) ?? 0) + 1);
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => Number(a.name === 'En ligne') - Number(b.name === 'En ligne') || b.count - a.count || this.i18n.compare(a.name, b.name));
  });
  protected filteredEvents = computed(() => {
    const list = this.events() ?? [];
    const city = this.city();
    return city ? list.filter((e) => e.city === city) : list;
  });
  protected visibleEvents = computed(() => {
    const list = this.filteredEvents();
    return this.allEvents() ? list : list.slice(0, this.eventsShown);
  });

  protected articles = signal<Article[]>([]);
  protected categories = signal<Category[]>([]);
  protected count = signal(0);
  protected loading = signal(true);
  protected error = signal(false);
  /** Filtre par catégorie, appliqué sur place aux articles déjà affichés (sans recharger la page). */
  protected selectedCategory = linkedSignal<string | null>(() => this.category() ?? null);
  protected shownArticles = computed(() => {
    const slug = this.selectedCategory();
    return slug ? this.articles().filter((a) => a.category_detail?.slug === slug) : this.articles();
  });
  /** Seules les catégories présentes parmi les articles affichés sont proposées. */
  protected shownCategories = computed(() => {
    const used = new Set(this.articles().map((a) => a.category));
    return this.categories().filter((c) => used.has(c.id));
  });

  protected pageNum = computed(() => Math.max(1, Number(this.page()) || 1));
  protected pages = computed(() => Math.max(1, Math.ceil(this.count() / 9)));

  constructor() {
    this.api.categories().subscribe({ next: (c) => this.categories.set(c), error: () => {} });
    effect((onCleanup) => {
      const query = {
        page: this.pageNum(),
        search: this.search(),
        mine: !!this.mine(),
      };
      this.loading.set(true);
      this.error.set(false);
      const sub = this.api.articles(query).subscribe({
        next: (res) => {
          this.articles.set(res.results);
          this.count.set(res.count);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  go(params: Record<string, string | number | null>) {
    this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge' });
  }
}
