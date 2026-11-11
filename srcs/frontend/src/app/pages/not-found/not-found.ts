import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="container container-narrow">
        <span class="sticker">Erreur 404</span>
        <h1>Cette page s'est perdue en route</h1>
        <p class="lead">La page demandée n'existe pas ou a été déplacée.</p>
        <a routerLink="/" class="btn">Retour à l'accueil</a>
      </div>
    </section>
  `,
})
export class NotFound {}
