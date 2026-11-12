import { Component, computed, inject, signal } from '@angular/core';
import { I18n } from '../../core/i18n';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Photo } from '../../shared/photo';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { CAMPAIGN, COUNTRIES } from '../../core/campaign.config';

@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RouterLink, Photo],
  template: `
    <section class="page-hero">
      <div class="container">
        @let t = i18n.d().contact;
        <span class="eyebrow">{{ t.eyebrow }}</span>
        <h1>{{ t.title }}</h1>
        <p class="lead">{{ t.lead }}</p>
      </div>
    </section>

    <section class="section">
      <div class="container contact-grid">
        <div class="card">
          @if (sent()) {
            <div class="alert alert-ok" role="status">{{ i18n.d().contact.sent }}</div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="form-grid">
              <div class="field">
                <label for="ct-name">{{ i18n.d().contact.name }}</label>
                <input id="ct-name" type="text" formControlName="name" autocomplete="name" />
              </div>
              <div class="field">
                <label for="ct-email">{{ i18n.d().contact.email }}</label>
                <input id="ct-email" type="email" formControlName="email" autocomplete="email" />
              </div>
              <div class="field">
                <label for="ct-country">{{ i18n.d().contact.country }}</label>
                <select id="ct-country" formControlName="country">
                  <option value="">—</option>
                  @for (p of countries(); track p.code) { <option [value]="p.code">{{ p.name }}</option> }
                  <option value="XX">{{ i18n.d().common.otherCountry }}</option>
                </select>
              </div>
              <div class="field">
                <label for="ct-subject">{{ i18n.d().contact.subject }}</label>
                <input id="ct-subject" type="text" formControlName="subject" />
              </div>
              <div class="field full">
                <label for="ct-message">{{ i18n.d().contact.message }}</label>
                <textarea id="ct-message" rows="7" formControlName="message"></textarea>
              </div>
              <p class="full hint muted">{{ i18n.d().contact.privacy }} <a routerLink="/mentions-legales">{{ i18n.d().contact.more }}</a>.</p>
              @if (error()) { <div class="full alert alert-err" role="alert">{{ error() }}</div> }
              <div class="full">
                <button class="btn btn-rouge" type="submit" [disabled]="sending()">{{ sending() ? i18n.d().common.sending : i18n.d().common.send }}</button>
              </div>
            </form>
          }
        </div>

        <aside class="stack">
          <app-photo class="contact-photo" name="equipeBerlin" sizes="(max-width: 900px) 100vw, 400px" position="55% 30%" />
          <div class="card-flat">
            <h3>{{ i18n.d().contact.byEmail }}</h3>
            <p><a [href]="'mailto:' + c.contactEmail">{{ c.contactEmail }}</a></p>
          </div>
          @if (socials().length) {
            <div class="card-flat">
              <h3>{{ i18n.d().contact.follow }}</h3>
              <div class="btn-row">
                @for (s of socials(); track s.id) {
                  <a [href]="s.url" target="_blank" rel="noopener" class="btn btn-outline btn-sm">{{ s.label }}</a>
                }
              </div>
            </div>
          }
        </aside>
      </div>
    </section>
  `,
  styles: `
    .contact-grid { display: grid; gap: 32px; grid-template-columns: 1.6fr 1fr; align-items: start; }
    h3 { font-size: 24px; }
    .contact-photo { aspect-ratio: 4 / 3; border-radius: var(--radius); overflow: hidden; }
    .hint { font-size: 13px; margin: 0; }
    @media (max-width: 900px) { .contact-grid { grid-template-columns: 1fr; } }
  `,
})
export class Contact {
  private api = inject(ApiService);
  protected c = CAMPAIGN;
  protected i18n = inject(I18n);
  /** Pays de la circonscription, nommés et triés dans la langue du site. */
  protected countries = computed(() =>
    COUNTRIES.map((c) => ({ code: c.code, name: this.i18n.country(c.code) })).sort((a, b) => this.i18n.compare(a.name, b.name)),
  );
  protected socials = toSignal(this.api.footerLinks().pipe(map((l) => l.socials)), { initialValue: [] });
  protected sending = signal(false);
  protected sent = signal(false);
  protected error = signal('');

  protected form = inject(NonNullableFormBuilder).group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    country: [''],
    subject: ['', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  submit() {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.i18n.d().contact.errorRequired);
      return;
    }
    this.sending.set(true);
    this.api.contact(this.form.getRawValue()).subscribe({
      next: () => {
        this.sent.set(true);
        this.sending.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, this.i18n.d().errors));
        this.sending.set(false);
      },
    });
  }
}
