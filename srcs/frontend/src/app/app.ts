import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './layout/header/header';
import { Footer } from './layout/footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  template: `
    <a class="skip-link" href="#contenu">Aller au contenu</a>
    <app-header />
    <main id="contenu" tabindex="-1">
      <router-outlet />
    </main>
    <app-footer />
  `,
})
export class App {}
