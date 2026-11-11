import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { CAMPAIGN } from '../../core/campaign.config';
import { I18n } from '../../core/i18n';
import { LangSwitch } from '../lang-switch/lang-switch';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, LangSwitch],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected auth = inject(AuthService);
  protected i18n = inject(I18n);
  protected c = CAMPAIGN;
  private router = inject(Router);
  protected open = signal(false);

  protected links = [
    { path: '/programme', key: 'programme', exact: false },
    { path: '/circonscription', key: 'circonscription', exact: false },
    { path: '/inscription-listes-electorales', key: 'voter', exact: false },
    { path: '/blog', key: 'news', exact: false },
    { path: '/contact', key: 'contact', exact: false },
  ] as const;

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.open.set(false));
  }

  logout() {
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/'));
  }
}
