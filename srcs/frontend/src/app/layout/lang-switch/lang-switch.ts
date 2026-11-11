import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { I18n, LANGS, Lang } from '../../core/i18n';

/** Pictogramme « langue » — Font Awesome Free 6.7.2 (solid « language »), licence CC BY 4.0. */
const LANG_ICON = 'M0 128C0 92.7 28.7 64 64 64l192 0 48 0 16 0 256 0c35.3 0 64 28.7 64 64l0 256c0 35.3-28.7 64-64 64l-256 0-16 0-48 0L64 448c-35.3 0-64-28.7-64-64L0 128zm320 0l0 256 256 0 0-256-256 0zM178.3 175.9c-3.2-7.2-10.4-11.9-18.3-11.9s-15.1 4.7-18.3 11.9l-64 144c-4.5 10.1 .1 21.9 10.2 26.4s21.9-.1 26.4-10.2l8.9-20.1 73.6 0 8.9 20.1c4.5 10.1 16.3 14.6 26.4 10.2s14.6-16.3 10.2-26.4l-64-144zM160 233.2L179 276l-38 0 19-42.8zM448 164c11 0 20 9 20 20l0 4 44 0 16 0c11 0 20 9 20 20s-9 20-20 20l-2 0-1.6 4.5c-8.9 24.4-22.4 46.6-39.6 65.4c.9 .6 1.8 1.1 2.7 1.6l18.9 11.3c9.5 5.7 12.5 18 6.9 27.4s-18 12.5-27.4 6.9l-18.9-11.3c-4.5-2.7-8.8-5.5-13.1-8.5c-10.6 7.5-21.9 14-34 19.4l-3.6 1.6c-10.1 4.5-21.9-.1-26.4-10.2s.1-21.9 10.2-26.4l3.6-1.6c6.4-2.9 12.6-6.1 18.5-9.8l-12.2-12.2c-7.8-7.8-7.8-20.5 0-28.3s20.5-7.8 28.3 0l14.6 14.6 .5 .5c12.4-13.1 22.5-28.3 29.8-45L448 228l-72 0c-11 0-20-9-20-20s9-20 20-20l52 0 0-4c0-11 9-20 20-20z';

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
      <svg viewBox="0 0 640 512" aria-hidden="true" focusable="false"><path [attr.d]="icon" /></svg>
      <span class="lang-code" aria-hidden="true">{{ current().short }}</span>
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
      display: inline-flex; align-items: center; gap: 6px;
      height: 44px; padding: 0 12px;
      border: 2px solid var(--violet); border-radius: 10px;
      background: transparent; color: var(--violet);
      font: inherit; font-weight: 700; font-size: 14px; cursor: pointer;
      transition: background .15s, color .15s;
      svg { width: 22px; height: 22px; fill: currentColor; }
      &:hover, &[aria-expanded='true'] { background: var(--violet); color: var(--creme); }
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
  protected icon = LANG_ICON;
  protected open = signal(false);
  private toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  private host = inject(ElementRef<HTMLElement>);

  protected current() {
    return LANGS.find((l) => l.code === this.i18n.lang())!;
  }

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
