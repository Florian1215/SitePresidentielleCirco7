import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Photo } from '../../shared/photo';
import { CAMPAIGN, daysUntil } from '../../core/campaign.config';
import { I18n } from '../../core/i18n';
import { SupporterForm } from '../../shared/supporter-form';
import { STEP_ICONS } from './step-icons';

@Component({
  selector: 'app-voter',
  imports: [SupporterForm, Photo],
  templateUrl: './voter.html',
  styleUrl: './voter.scss',
})
export class Voter {
  // ---------- Animation des 3 étapes ----------
  private track = viewChild.required<ElementRef<HTMLElement>>('track');
  /** Avancement du bulletin sur le rail, de 0 (départ) à 1 (dans l'urne). */
  protected progress = signal(0);
  protected done = computed(() => this.progress() >= 1);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.progress.set(1);
        return;
      }
      const el = this.track().nativeElement;
      let frame = 0;
      const update = () => {
        frame = 0;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const top = r.top + window.scrollY; // position du rail dans la page
        // Départ : quand le rail entre par le bas de l'écran (ou dès le haut de la page s'il est déjà visible).
        // Arrivée : quand le milieu des étapes passe vers le milieu de l'écran, après au moins 1/3 d'écran de défilement.
        const s0 = Math.max(0, top - vh * 0.9);
        const s1 = Math.max(s0 + vh / 3, top + r.height / 2 - vh * 0.5);
        const p = (window.scrollY - s0) / (s1 - s0);
        this.progress.set(Math.round(Math.min(1, Math.max(0, p)) * 1000) / 1000);
      };
      const onScroll = () => (frame ||= requestAnimationFrame(update));
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
      destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        cancelAnimationFrame(frame);
      });
    });
  }

  protected c = CAMPAIGN;
  protected l = CAMPAIGN.links;
  protected icons = STEP_ICONS;

  protected i18n = inject(I18n);

  /** Feuilles du calendrier « Les dates à retenir ». */
  protected dates = computed(() => {
    const t = this.i18n.d().voter;
    const e = CAMPAIGN.election;
    const consulate = this.i18n.date(e.registrationDeadlineConsulate, { day: 'numeric', month: 'long' });
    return [
      this.sheet(e.registrationDeadlineOnline, t.deadline, 'rouge', this.i18n.f(t.deadlineNote, { date: consulate })),
      this.sheet(e.firstRound, t.firstRound, 'violet'),
      this.sheet(e.secondRound, t.secondRound, 'jaune'),
    ];
  });

  private sheet(iso: string, label: string, color: string, note = '') {
    return {
      label,
      note,
      color,
      day: new Date(iso + 'T12:00:00').getDate(),
      month: this.i18n.date(iso, { month: 'long' }),
      year: new Date(iso + 'T12:00:00').getFullYear(),
      weekday: this.i18n.date(iso, { weekday: 'long' }),
      daysLeft: daysUntil(iso),
    };
  }

  /** `at` : avancement du bulletin à partir duquel l'étape s'allume. */
  private stepLinks = [
    { icon: 'check' as const, url: CAMPAIGN.links.checkSituation, at: 0.02 },
    { icon: 'register' as const, url: CAMPAIGN.links.registerOnline, at: 0.5 },
    { icon: 'vote' as const, url: CAMPAIGN.links.procuration, at: 1 },
  ];
  protected steps = computed(() => this.i18n.d().voter.steps.map((s, i) => ({ ...s, ...this.stepLinks[i] })));

}
