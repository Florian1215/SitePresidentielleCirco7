import { AfterViewInit, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CAMPAIGN } from '../../core/campaign.config';
import { CATEGORY_ICONS } from '../../data/category-icons';
import { I18n } from '../../core/i18n';
import { ProgrammeContent } from '../../data/programme.i18n';

@Component({
  selector: 'app-programme',
  imports: [RouterLink],
  templateUrl: './programme.html',
  styleUrl: './programme.scss',
})
export class Programme implements AfterViewInit {
  protected c = CAMPAIGN;
  protected i18n = inject(I18n);
  protected categories = inject(ProgrammeContent).categories;
  protected icons = CATEGORY_ICONS;

  ngAfterViewInit() {
    // Le composant étant chargé paresseusement, on rejoue l'ancre (#ecologie, #monde…) une fois rendu.
    const hash = location.hash.slice(1);
    if (hash) setTimeout(() => this.scrollTo(hash));
  }

  scrollTo(slug: string, event?: Event) {
    const el = document.getElementById(slug);
    if (!el) return;
    event?.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Chemin complet : avec <base href="/">, un simple '#slug' renverrait vers l'accueil
    history.replaceState(history.state, '', location.pathname + location.search + '#' + slug);
  }
}
