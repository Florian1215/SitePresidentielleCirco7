import { Component, inject } from '@angular/core';
import { I18n } from '../../core/i18n';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="container container-narrow">
        <span class="sticker">{{ i18n.d().notFound.badge }}</span>
        <h1>{{ i18n.d().notFound.title }}</h1>
        <p class="lead">{{ i18n.d().notFound.lead }}</p>
        <a routerLink="/" class="btn">{{ i18n.d().notFound.back }}</a>
      </div>
    </section>
  `,
})
export class NotFound {
  protected i18n = inject(I18n);
}
