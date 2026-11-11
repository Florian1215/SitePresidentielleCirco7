import { Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, apiErrorMessage } from '../core/api.service';
import { COUNTRIES } from '../core/campaign.config';

@Component({
  selector: 'app-supporter-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (done()) {
      <div class="alert alert-ok" role="status">
        <strong>Merci !</strong> Votre inscription est bien enregistrée. Nous vous recontacterons
        @if (form.value.wants_registration_help) { pour vous aider à vous inscrire sur la liste électorale consulaire }
        @else { avant les échéances importantes }.
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="form-grid">
        <div class="field">
          <label for="sf-first">Prénom *</label>
          <input id="sf-first" type="text" formControlName="first_name" autocomplete="given-name" />
        </div>
        <div class="field">
          <label for="sf-last">Nom *</label>
          <input id="sf-last" type="text" formControlName="last_name" autocomplete="family-name" />
        </div>
        <div class="field">
          <label for="sf-email">E-mail *</label>
          <input id="sf-email" type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <span class="error">Adresse e-mail invalide.</span>
          }
        </div>
        <div class="field">
          <label for="sf-phone">Téléphone</label>
          <input id="sf-phone" type="tel" formControlName="phone" autocomplete="tel" />
        </div>
        <div class="field">
          <label for="sf-country">Pays de résidence *</label>
          <select id="sf-country" formControlName="country">
            <option value="" disabled>Choisir…</option>
            @for (c of countries; track c.code) {
              <option [value]="c.code">{{ c.name }}</option>
            }
            <option value="XX">Autre pays</option>
          </select>
        </div>
        <div class="field">
          <label for="sf-city">Ville</label>
          <input id="sf-city" type="text" formControlName="city" autocomplete="address-level2" />
        </div>
        <div class="full stack">
          <label class="check">
            <input type="checkbox" formControlName="wants_registration_help" />
            <span>Je souhaite être aidé·e pour m'inscrire sur la liste électorale consulaire</span>
          </label>
          <label class="check">
            <input type="checkbox" formControlName="wants_reminders" />
            <span>Je souhaite recevoir les rappels (date limite d'inscription, jours de vote)</span>
          </label>
          <label class="check">
            <input type="checkbox" formControlName="wants_to_volunteer" />
            <span>Je veux participer à la campagne près de chez moi</span>
          </label>
          <label class="check">
            <input type="checkbox" formControlName="consent" />
            <span>
              J'accepte que mes données soient utilisées par l'équipe de campagne pour me recontacter
              dans le cadre de l'élection présidentielle 2027 (<a routerLink="/mentions-legales">en savoir plus</a>). *
            </span>
          </label>
        </div>
        @if (error()) {
          <div class="full alert alert-err" role="alert">{{ error() }}</div>
        }
        <div class="full">
          <button class="btn btn-rouge" type="submit" [disabled]="sending()">
            {{ sending() ? 'Envoi…' : submitLabel() }}
          </button>
        </div>
      </form>
    }
  `,
})
export class SupporterForm implements OnInit {
  readonly helpPreset = input(false);
  readonly submitLabel = input('Je soutiens');

  private api = inject(ApiService);
  private fb = inject(NonNullableFormBuilder);
  protected countries = COUNTRIES.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  protected sending = signal(false);
  protected done = signal(false);
  protected error = signal('');

  protected form = this.fb.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    country: ['', Validators.required],
    city: [''],
    wants_registration_help: [false],
    wants_reminders: [true],
    wants_to_volunteer: [false],
    consent: [false, Validators.requiredTrue],
  });

  ngOnInit() {
    if (this.helpPreset()) this.form.controls.wants_registration_help.setValue(true);
  }

  submit() {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(
        this.form.controls.consent.invalid
          ? 'Merci de remplir les champs obligatoires (*) et de cocher la case de consentement.'
          : 'Merci de remplir les champs obligatoires (*).',
      );
      return;
    }
    this.sending.set(true);
    this.api.supporter(this.form.getRawValue()).subscribe({
      next: () => {
        this.done.set(true);
        this.sending.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.sending.set(false);
      },
    });
  }
}
