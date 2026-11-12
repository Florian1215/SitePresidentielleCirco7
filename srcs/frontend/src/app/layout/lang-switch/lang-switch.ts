import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { I18n, LANGS, Lang } from '../../core/i18n';

/** Bouton des langues (en haut à droite) : ouvre un petit menu Français / English / Deutsch. */
@Component({
  selector: 'app-lang-switch',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close(true)',
  },
  template: `
    <button
      #toggle
      type="button"
      class="lang-toggle"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      aria-controls="lang-menu"
      [attr.aria-label]="i18n.d().nav.chooseLanguage"
      [title]="i18n.d().nav.chooseLanguage"
      (click)="open.set(!open())"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M2.5 12h19M12 2.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5c-2.6-2.6-4-6-4-9.5s1.4-6.9 4-9.5z" />
      </svg>
    </button>
    @if (open()) {
      <ul id="lang-menu" class="lang-menu" role="menu" [attr.aria-label]="i18n.d().nav.language">
        @for (l of langs; track l.code) {
          <li role="none">
            <button
              type="button"
              role="menuitemradio"
              [attr.aria-checked]="l.code === i18n.lang()"
              [attr.lang]="l.code"
              [class.on]="l.code === i18n.lang()"
              (click)="choose(l.code)"
            >
              <span class="lang-short" aria-hidden="true">{{ l.short }}</span>
              {{ l.label }}
              @if (l.code === i18n.lang()) { <span class="check" aria-hidden="true">✓</span> }
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .lang-toggle {
      display: inline-grid; place-items: center;
      width: 40px; height: 40px; padding: 0;
      border: 0; border-radius: 50%;
      background: transparent; color: var(--violet); opacity: .75; cursor: pointer;
      transition: background .15s, opacity .15s;
      svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
      &:hover, &[aria-expanded='true'] { opacity: 1; background: var(--lavande); }
      &:focus-visible { outline: 3px solid var(--jaune); outline-offset: 2px; }
    }
    .lang-menu {
      position: absolute; z-index: 60; top: calc(100% + 8px); right: 0;
      min-width: 190px; margin: 0; padding: 6px; list-style: none;
      background: #fff; border-radius: 12px; box-shadow: 0 14px 34px rgba(33, 35, 32, .2);
      button {
        display: flex; align-items: center; gap: 10px; width: 100%;
        padding: 10px 12px; border: 0; border-radius: 8px; background: none;
        color: var(--noir); font: inherit; font-weight: 600; font-size: 15px; text-align: left; cursor: pointer;
        &:hover, &:focus-visible { background: var(--lavande); color: var(--violet); outline: none; }
        &.on { color: var(--violet); }
      }
    }
    .lang-short {
      display: inline-grid; place-items: center; width: 30px; height: 22px; border-radius: 5px;
      background: var(--gris-clair); color: var(--violet); font-size: 12px; font-weight: 800;
    }
    .on .lang-short { background: var(--violet); color: var(--creme); }
    .check { margin-left: auto; color: var(--rouge); font-weight: 900; }
  `,
})
export class LangSwitch {
  protected i18n = inject(I18n);
  protected langs = LANGS;
  protected open = signal(false);
  private toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  private host = inject(ElementRef<HTMLElement>);

  protected choose(code: Lang) {
    this.i18n.set(code);
    this.close(true);
  }

  protected close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.toggle().nativeElement.focus();
  }

  protected onDocumentClick(event: MouseEvent) {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
