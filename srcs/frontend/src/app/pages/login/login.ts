import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <section class="section">
      <div class="container login-wrap">
        <div class="card">
          <span class="eyebrow">Espace rédaction</span>
          <h1 class="h2">Connexion</h1>
          @if (auth.user(); as u) {
            <p>Vous êtes connecté·e en tant que <strong>{{ u.username }}</strong>.</p>
            @if (!auth.canWrite()) {
              <div class="alert alert-info">
                Votre compte n'a pas encore le droit d'écrire des articles. Demandez à un·e administrateur·ice
                de vous ajouter au groupe « Rédacteur·ices ».
              </div>
            }
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
              <div class="field">
                <label for="lg-user">Identifiant</label>
                <input id="lg-user" type="text" formControlName="username" autocomplete="username" />
              </div>
              <div class="field">
                <label for="lg-pass">Mot de passe</label>
                <input id="lg-pass" type="password" formControlName="password" autocomplete="current-password" />
              </div>
              @if (error()) { <div class="alert alert-err" role="alert">{{ error() }}</div> }
              <button class="btn" type="submit" [disabled]="sending() || form.invalid">
                {{ sending() ? 'Connexion…' : 'Se connecter' }}
              </button>
              <p class="muted small">
                Les comptes sont créés par les administrateur·ices du site. Pas encore de compte ?
                Contactez l'équipe de campagne.
              </p>
            </form>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .login-wrap { max-width: 480px; }
    .small { font-size: 14px; margin: 0; }
  `,
})
export class Login {
  readonly next = input<string>();
  protected auth = inject(AuthService);
  private router = inject(Router);
  protected sending = signal(false);
  protected error = signal('');
  protected form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit() {
    const { username, password } = this.form.getRawValue();
    this.sending.set(true);
    this.error.set('');
    this.auth.login(username, password).subscribe({
      next: () => {
        this.sending.set(false);
        const next = this.next();
        const target = next && next.startsWith('/') && !next.startsWith('//') ? next : this.auth.canWrite() ? '/blog' : '/';
        this.router.navigateByUrl(target);
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }
}
