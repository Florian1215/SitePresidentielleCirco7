import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CAMPAIGN, COUNTRIES, daysUntil } from '../../core/campaign.config';
import { I18n } from '../../core/i18n';
import { ProgrammeContent } from '../../data/programme.i18n';
import { CATEGORY_ICONS } from '../../data/category-icons';
import { Photo } from '../../shared/photo';
import { EventCard } from '../../shared/event-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, Photo, EventCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private api = inject(ApiService);
  protected i18n = inject(I18n);
  private programme = inject(ProgrammeContent);

  protected c = CAMPAIGN;
  protected icons = CATEGORY_ICONS;

  /** Les trois urgences, reliées à leur partie du programme (couleur, picto, mesures phares). */
  protected urgences = computed(() =>
    this.programme.urgences().map((u) => {
      const cat = this.programme.categories().find((c) => c.slug === u.slug)!;
      return { ...u, cat, keys: cat.mesures.filter((m) => m.key).slice(0, 3), count: cat.mesures.length };
    }),
  );

  /** Affiches du haut de page : chacune ouvre la partie correspondante du programme. */
  private posterSlugs = ['securite-sociale', 'futur', 'ecologie', 'monde'];
  protected posters = computed(() => this.i18n.d().home.posters.map((p, i) => ({ ...p, slug: this.posterSlugs[i] })));
  protected countryCount = COUNTRIES.length;
  protected events = toSignal(this.api.events(), { initialValue: [] });

  /** Bandeau : la date en grand, le nombre de jours restants en petit. */
  protected keyDates = computed(() => {
    const t = this.i18n.d().home;
    const e = CAMPAIGN.election;
    return [
      this.keyDate(e.registrationDeadlineOnline, t.deadline,
        this.i18n.f(t.consulate, { date: this.i18n.date(e.registrationDeadlineConsulate, { day: 'numeric', month: 'long' }) })),
      this.keyDate(e.firstRound, t.firstRound),
    ];
  });

  /** Date clé du bandeau : jour et mois en grand, jours restants. */
  private keyDate(iso: string, label: string, note = '') {
    return {
      label,
      note,
      day: new Date(iso + 'T12:00:00').getDate(),
      month: this.i18n.date(iso, { month: 'short' }).replace('.', ''),
      weekday: this.i18n.date(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      daysLeft: daysUntil(iso),
    };
  }

  // ---------- Compteur de soutiens (Action populaire) ----------
  private soutien = viewChild.required<ElementRef<HTMLElement>>('soutien');
  protected supporters = signal<number | null>(null);
  protected displayCount = signal(0);
  private counted = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const load = () =>
        this.api.supportersCount().subscribe({
          next: ({ count }) => {
            if (count === null) return;
            this.supporters.set(count);
            // Après la première animation, le chiffre suit simplement les mises à jour
            if (this.counted) this.displayCount.set(count);
          },
          error: () => {},
        });
      load();
      const timer = setInterval(load, 30_000);

      // Le chiffre défile quand la section arrive à l'écran
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          this.countUp();
        },
        { threshold: 0.4 },
      );
      observer.observe(this.soutien().nativeElement);
      destroyRef.onDestroy(() => {
        clearInterval(timer);
        observer.disconnect();
      });
    });
  }

  private countUp() {
    const target = this.supporters();
    if (target === null) {
      // Chiffre pas encore reçu : on réessaie un peu plus tard
      setTimeout(() => this.countUp(), 300);
      return;
    }
    this.counted = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.displayCount.set(target);
      return;
    }
    const start = performance.now();
    const from = Math.round(target * 0.8);
    const duration = 1600;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      // La valeur peut avoir été mise à jour entre-temps
      const goal = this.supporters() ?? target;
      this.displayCount.set(Math.round(from + (goal - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
