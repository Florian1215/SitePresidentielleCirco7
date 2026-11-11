import { Component, ElementRef, computed, input, viewChild } from '@angular/core';
import { CampaignEvent } from '../core/models';
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from './calendar-links';

const CAL_ICON =
  'M96 32l0 32L48 64C21.5 64 0 85.5 0 112l0 48 448 0 0-48c0-26.5-21.5-48-48-48l-48 0 0-32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 32L160 64l0-32c0-17.7-14.3-32-32-32S96 14.3 96 32zM448 192L0 192 0 464c0 26.5 21.5 48 48 48l352 0c26.5 0 48-21.5 48-48l0-272zM224 248c13.3 0 24 10.7 24 24l0 56 56 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-56 0 0 56c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-56-56 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l56 0 0-56c0-13.3 10.7-24 24-24z';

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString('fr-FR', o);

/** Carte d'un événement de l'agenda (calendrier Zetkin). */
@Component({
  selector: 'app-event-card',
  host: { '(document:click)': 'closeMenu($event)' },
  template: `
    @let e = event();
    <article class="ev">
      <div class="ev-visual" [class.empty]="!e.image">
        @if (e.image) {
          <img class="ev-bg" [src]="e.image" alt="" loading="lazy" decoding="async" aria-hidden="true" />
          <img class="ev-img" [src]="e.image" alt="" loading="lazy" decoding="async" />
        }
        <div class="ev-date" aria-hidden="true">
          <span class="ev-month">{{ month() }}</span>
          <span class="ev-day">{{ day() }}</span>
          <span class="ev-weekday">{{ weekday() }}</span>
        </div>
      </div>

      <div class="ev-body">
        <p class="ev-meta">
          <span class="ev-time">{{ longDate() }} · {{ when() }}</span>
          @if (e.location) { <span class="ev-place">{{ e.location }}</span> }
        </p>
        <h3>{{ e.title }}</h3>
        @if (excerpt()) { <p class="ev-text">{{ excerpt() }}</p> }

        <div class="ev-actions">
          <a [href]="e.url" target="_blank" rel="noopener" class="btn btn-rouge btn-sm">
            Je participe<span class="visually-hidden"> : {{ e.title }}</span>
          </a>
          <details class="add-cal" #menu>
            <summary class="btn btn-outline btn-sm" title="Ajouter à mon agenda">
              <svg viewBox="0 0 448 512" aria-hidden="true"><path [attr.d]="calIcon" /></svg>
              <span class="visually-hidden">Ajouter à mon </span>Agenda
            </summary>
            <ul class="add-cal-menu" (click)="menu.open = false">
              <li><a [href]="google()" target="_blank" rel="noopener">Google Agenda</a></li>
              <li><a [href]="outlook()" target="_blank" rel="noopener">Outlook</a></li>
              <li><button type="button" (click)="ics()">Apple, Proton, autre (.ics)</button></li>
            </ul>
          </details>
        </div>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; height: 100%; }
    /* La carte dont le menu est ouvert passe au-dessus de ses voisines */
    :host:has(details[open]) { position: relative; z-index: 10; }
    .ev {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      transition: transform .2s, box-shadow .2s;
      &:hover { transform: translateY(-3px); box-shadow: 0 16px 36px rgba(33, 35, 32, .14); }
    }

    /* Visuel : l'affiche entière, sur un fond flouté de la même image */
    .ev-visual {
      position: relative;
      aspect-ratio: 16 / 10;
      border-radius: var(--radius) var(--radius) 0 0;
      overflow: hidden;
      background: var(--violet);
    }
    .ev-visual.empty { background: linear-gradient(135deg, var(--violet), var(--violet-vif)); }
    .ev-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(18px) saturate(1.2); transform: scale(1.2); opacity: .75; }
    .ev-img { position: relative; width: 100%; height: 100%; object-fit: contain; }

    /* Date façon feuille de calendrier, posée sur le visuel */
    .ev-date {
      position: absolute; left: 14px; bottom: 12px;
      display: flex; flex-direction: column; align-items: center;
      width: 64px; border-radius: 10px; overflow: hidden; text-align: center;
      background: #fff; box-shadow: 0 6px 16px rgba(0, 0, 0, .25);
    }
    .ev-month {
      align-self: stretch; padding: 3px 0; background: var(--rouge); color: var(--creme);
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
    }
    .ev-day { font-family: var(--font-titre); font-size: 32px; line-height: 1.05; color: var(--noir); margin-top: 2px; }
    .ev-weekday { font-size: 11px; font-weight: 700; color: var(--texte); margin-bottom: 5px; text-transform: capitalize; }

    .ev-body { display: flex; flex-direction: column; align-items: flex-start; flex: 1; min-width: 0; padding: 16px 18px 18px; }
    .ev-meta { display: flex; flex-direction: column; gap: 2px; margin: 0 0 8px; font-size: 13px; }
    .ev-time { font-weight: 700; color: var(--rouge); }
    .ev-place { color: var(--texte); font-weight: 500; }
    h3, .ev-text, .ev-place { overflow-wrap: anywhere; }
    h3 {
      font-family: var(--font-texte); font-weight: 700; font-size: 18px; line-height: 1.3; color: var(--noir); margin: 0 0 8px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .ev-text {
      margin: 0 0 16px; font-size: 14px; color: var(--texte);
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .ev-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; }

    /* Menu « Ajouter à mon agenda » */
    .add-cal { position: relative; }
    .add-cal summary { list-style: none; gap: 8px; }
    .add-cal summary::-webkit-details-marker { display: none; }
    .add-cal summary svg { width: 14px; height: 14px; fill: currentColor; }
    .add-cal[open] summary { background: var(--violet); color: var(--creme); }
    .add-cal-menu {
      position: absolute; z-index: 5; top: calc(100% + 6px); left: 0;
      min-width: 230px; margin: 0; padding: 6px; list-style: none;
      background: #fff; border-radius: 10px; box-shadow: 0 12px 30px rgba(33, 35, 32, .2);
    }
    .add-cal-menu a, .add-cal-menu button {
      display: block; width: 100%; border: 0; background: none; text-align: left; cursor: pointer; font-family: inherit; padding: 9px 12px; border-radius: 6px;
      color: var(--noir); font-weight: 700; font-size: 14px; text-decoration: none;
      &:hover { background: var(--lavande); color: var(--violet); }
    }

    @media (prefers-reduced-motion: reduce) { .ev, .ev:hover { transform: none; } }
  `,
})
export class EventCard {
  readonly event = input.required<CampaignEvent>();

  // Les heures Zetkin sont « flottantes » (heure locale du lieu) : on les lit sans conversion de fuseau.
  private start = computed(() => new Date(this.event().start));
  private end = computed(() => new Date(this.event().end));

  protected day = computed(() => this.start().getDate());
  protected month = computed(() => fmt(this.start(), { month: 'short' }).replace('.', ''));
  /** « Samedi 14 novembre » (majuscule au jour seulement). */
  protected longDate = computed(() => {
    const d = fmt(this.start(), { weekday: 'long', day: 'numeric', month: 'long' });
    return d.charAt(0).toUpperCase() + d.slice(1);
  });
  protected weekday = computed(() => fmt(this.start(), { weekday: 'short' }).replace('.', ''));
  protected when = computed(() => {
    const t = (d: Date) => fmt(d, { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const sameDay = this.start().toDateString() === this.end().toDateString();
    return sameDay ? `${t(this.start())} – ${t(this.end())}` : `${t(this.start())} → ${fmt(this.end(), { day: 'numeric', month: 'long' })}`;
  });
  private menu = viewChild<ElementRef<HTMLDetailsElement>>('menu');

  /** Ferme le menu « Ajouter à mon agenda » quand on clique ailleurs. */
  protected closeMenu(event: MouseEvent) {
    const el = this.menu()?.nativeElement;
    if (el?.open && !el.contains(event.target as Node)) el.open = false;
  }

  protected google = computed(() => googleCalendarUrl(this.event()));
  protected outlook = computed(() => outlookCalendarUrl(this.event()));
  protected ics() {
    downloadIcs(this.event());
  }
  /** Pictogramme calendrier (Font Awesome Free, solid « calendar-plus », CC BY 4.0). */
  protected calIcon = CAL_ICON;

  protected excerpt = computed(() => this.event().description.replace(/\s*\n+\s*/g, ' ').trim());
}
