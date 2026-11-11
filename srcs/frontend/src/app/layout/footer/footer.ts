import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CAMPAIGN } from '../../core/campaign.config';
import { FOOTER_ICONS } from '../../shared/footer-icons';
import { I18n } from '../../core/i18n';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      @let l = links();
      @let t = i18n.d().footer;

      <div class="container footer-grid">
        <div class="brand">
          <a routerLink="/" class="brand-link" [attr.aria-label]="t.home">
            <img src="brand/circo7-square-192.webp" width="96" height="96" alt="" loading="lazy" />
            <span>
              <span class="brand-name">La France insoumise</span>
              <span class="brand-sub">{{ i18n.d().nav.logoSub }}</span>
            </span>
          </a>
          <ul class="small-links">
            <li><a routerLink="/mentions-legales">{{ t.legal }}</a></li>
            <li><a routerLink="/connexion">{{ t.writers }}</a></li>
          </ul>
        </div>

        <nav class="col" [attr.aria-label]="t.site">
          <p class="col-title">{{ t.site }}</p>
          <ul>
            <li><a routerLink="/programme">{{ t.programme }}</a></li>
            <li><a routerLink="/circonscription">{{ t.circonscription }}</a></li>
            <li><a routerLink="/inscription-listes-electorales">{{ t.voteAbroad }}</a></li>
            <li><a routerLink="/blog">{{ t.newsAgenda }}</a></li>
            <li><a routerLink="/contact">{{ t.contact }}</a></li>
          </ul>
        </nav>

        <div class="col">
          <p class="col-title">{{ t.act }}</p>
          <ul>
            <li>
              <a [href]="c.links.soutenir" target="_blank" rel="noopener" class="ext">
                <svg [attr.viewBox]="icons['external'].viewBox" aria-hidden="true"><path [attr.d]="icons['external'].d" /></svg>
                {{ t.supportCandidacy }}
              </a>
            </li>
            <li><a routerLink="/inscription-listes-electorales">{{ t.registerLists }}</a></li>
            <li>
              <a [href]="c.links.actionPopulaire" target="_blank" rel="noopener" class="ext">
                <svg [attr.viewBox]="icons['external'].viewBox" aria-hidden="true"><path [attr.d]="icons['external'].d" /></svg>
                {{ t.joinGroup }}
              </a>
            </li>
            <li><a [href]="'mailto:' + c.contactEmail">{{ t.writeUs }}</a></li>
          </ul>
        </div>

        <!-- Sites amis (admin Django → Sites amis) -->
        @if (l.friend_sites.length) {
          <div class="col">
            <p class="col-title">{{ t.friendSites }}</p>
            <ul>
              @for (site of l.friend_sites; track site.id) {
                <li>
                  <a [href]="site.url" target="_blank" rel="noopener" class="ext">
                    <svg [attr.viewBox]="icons['external'].viewBox" aria-hidden="true"><path [attr.d]="icons['external'].d" /></svg>
                    {{ site.name }}
                  </a>
                </li>
              }
            </ul>
          </div>
        }

        <!-- Réseaux sociaux (admin Django → Réseaux sociaux) -->
        @if (l.socials.length) {
          <div class="col">
            <p class="col-title">{{ t.networks }}</p>
            <ul>
              @for (s of l.socials; track s.id) {
                @let icon = icons[s.network] ?? icons['other'];
                <li>
                  <a [href]="s.url" target="_blank" rel="noopener me" class="social">
                    <svg [attr.viewBox]="icon.viewBox" aria-hidden="true" focusable="false"><path [attr.d]="icon.d" /></svg>
                    {{ s.label }}
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </div>

      <div class="container">
        <p class="footer-bottom">{{ i18n.f(t.copyright, { year: year, circo: i18n.d().common.circo }) }}</p>
      </div>
    </footer>
  `,
  styles: `
    .footer { background: var(--violet); color: var(--creme); padding: 48px 0 24px; }
    a { color: var(--creme); text-decoration: none; }
    a:hover { color: var(--jaune); text-decoration: underline; }
    ul { list-style: none; margin: 0; padding: 0; }

    /* Colonnes */
    .footer-grid { display: flex; flex-wrap: wrap; gap: 40px; }
    .col { flex: 1 1 160px; }
    .brand { flex: 1.4 1 260px; display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
    .brand-link { display: flex; align-items: center; gap: 12px; &:hover { text-decoration: none; color: var(--creme); } }
    .brand-link img { width: 96px; height: 96px; border-radius: 6px; }
    .brand-name { display: block; font-family: var(--font-titre); font-size: 26px; text-transform: uppercase; line-height: 1; }
    .brand-sub { display: block; font-size: 13px; font-weight: 700; color: var(--jaune); margin-top: 4px; }
    .small-links { display: grid; gap: 6px; font-size: 14px; }

    .col-title {
      margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 252, 244, .35);
      font-family: var(--font-titre); font-size: 22px; text-transform: uppercase; color: var(--jaune);
    }
    .col ul { display: grid; gap: 10px; }
    .ext { display: inline-flex; align-items: baseline; gap: 8px; }
    .social { display: inline-flex; align-items: center; gap: 10px; }
    .social svg { width: 16px; height: 16px; flex-shrink: 0; fill: currentColor; }
    .ext svg { width: 12px; height: 12px; flex-shrink: 0; fill: currentColor; opacity: .8; }

    .footer-bottom { margin: 48px 0 0; padding-top: 20px; border-top: 1px solid rgba(255, 252, 244, .25); font-size: 13px; opacity: .85; }

    @media (max-width: 700px) { .brand { flex-basis: 100%; } }
  `,
})
export class Footer {
  private api = inject(ApiService);
  protected i18n = inject(I18n);
  protected c = CAMPAIGN;
  protected icons = FOOTER_ICONS;
  protected year = new Date().getFullYear();
  protected links = toSignal(this.api.footerLinks(), { initialValue: { friend_sites: [], socials: [] } });
}
