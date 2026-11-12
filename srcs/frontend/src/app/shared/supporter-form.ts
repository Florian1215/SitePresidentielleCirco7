import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { I18n } from '../core/i18n';
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
        @let t = i18n.d().supporterForm;
        <strong>{{ t.thanks }}</strong> {{ t.saved }}
        {{ form.value.wants_registration_help ? t.willHelp : t.willRemind }}
      </div>
    } @else {
      @let t = i18n.d().supporterForm;
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="form-grid">
        <div class="field">
          <label for="sf-first">{{ t.firstName }}</label>
          <input id="sf-first" type="text" formControlName="first_name" autocomplete="given-name" />
        </div>
        <div class="field">
          <label for="sf-last">{{ t.lastName }}</label>
          <input id="sf-last" type="text" formControlName="last_name" autocomplete="family-name" />
        </div>
        <div class="field">
          <label for="sf-email">{{ t.email }}</label>
          <input id="sf-email" type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <span class="error">{{ t.invalidEmail }}</span>
          }
        </div>
        <div class="field">
          <label for="sf-phone">{{ t.phone }}</label>
          <input id="sf-phone" type="tel" formControlName="phone" autocomplete="tel" />
        </div>
        <div class="field">
          <label for="sf-country">{{ t.country }}</label>
          <select id="sf-country" formControlName="country">
            <option value="" disabled>{{ t.choose }}</option>
            @for (c of countries(); track c.code) {
              <option [value]="c.code">{{ c.name }}</option>
            }
            <option value="XX">{{ i18n.d().common.otherCountry }}</option>
          </select>
        </div>
        <div class="field">
          <label for="sf-city">{{ t.city }}</label>
          <input id="sf-city" type="text" formControlName="city" autocomplete="address-level2" />
        </div>
        <div class="full stack">
          <label class="check">
            <input type="checkbox" formControlName="wants_registration_help" />
            <span>{{ t.wantsHelp }}</span>
          </label>
          <label class="check">
            <input type="checkbox" formControlName="wants_reminders" />
            <span>{{ t.wantsReminders }}</span>
          </label>
          <label class="check">
            <input type="checkbox" formControlName="wants_to_volunteer" />
            <span>{{ t.wantsVolunteer }}</span>
          </label>
          <label class="check">
            <input type="checkbox" formControlName="consent" />
            <span>
              {{ t.consent }} (<a routerLink="/mentions-legales">{{ t.consentMore }}</a>). *
            </span>
          </label>
        </div>
        @if (error()) {
          <div class="full alert alert-err" role="alert">{{ error() }}</div>
        }
        <div class="full">
          <button class="btn btn-rouge" type="submit" [disabled]="sending()">
            {{ sending() ? i18n.d().common.sending : submitLabel() }}
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
  protected i18n = inject(I18n);
  /** Pays de la circonscription, nommés et triés dans la langue du site. */
  protected countries = computed(() =>
    COUNTRIES.map((c) => ({ code: c.code, name: this.i18n.country(c.code) })).sort((a, b) => this.i18n.compare(a.name, b.name)),
  );
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
          ? this.i18n.d().supporterForm.errConsent
          : this.i18n.d().supporterForm.errRequired,
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
        this.error.set(apiErrorMessage(err, this.i18n.d().errors));
        this.sending.set(false);
      },
    });
  }
}
