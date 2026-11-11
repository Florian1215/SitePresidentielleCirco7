import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18n } from './i18n';

/**
 * Titres d'onglet traduits : le `title` d'une route est une clé de i18n `titles` (ex. 'home'),
 * ou un texte fixe pour les pages de l'espace rédaction. Le titre suit aussi les changements de langue.
 */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private i18n = inject(I18n);
  private title = inject(Title);
  private current = signal<string | null>(null);

  constructor() {
    super();
    effect(() => {
      const key = this.current();
      if (!key) return; // page qui gère son propre titre (article)
      const titles = this.i18n.d().titles as Record<string, string>;
      this.title.setTitle(key in titles ? `${titles[key]} — ${titles['suffix']}` : key);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot) {
    this.current.set(this.buildTitle(snapshot) ?? null);
  }
}
