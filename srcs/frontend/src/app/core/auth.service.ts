import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { User } from './models';

const TOKEN_KEY = 'lfi7.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  readonly token = signal<string | null>(readToken());
  readonly user = signal<User | null>(null);
  readonly loaded = signal(false);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly canWrite = computed(() => this.hasPerm('blog.add_article'));
  readonly canPublish = computed(() => this.hasPerm('blog.publish_article'));

  hasPerm(perm: string): boolean {
    return this.user()?.permissions.includes(perm) ?? false;
  }

  /** Recharge l'utilisateur courant à partir du jeton stocké. */
  restore(): Observable<User | null> {
    if (!this.token()) {
      this.loaded.set(true);
      return of(null);
    }
    return this.http.get<User>('/api/auth/me/').pipe(
      tap((u) => this.user.set(u)),
      catchError((err: { status?: number }) => {
        // On ne déconnecte que si le jeton est refusé, pas en cas de panne réseau / 502.
        if (err?.status === 401 || err?.status === 403) this.clear();
        return of(null);
      }),
      tap(() => this.loaded.set(true)),
    );
  }

  login(username: string, password: string) {
    return this.http
      .post<{ token: string; user: User }>('/api/auth/login/', { username, password })
      .pipe(
        tap(({ token, user }) => {
          this.setToken(token);
          this.user.set(user);
        }),
      );
  }

  logout() {
    return this.http.post('/api/auth/logout/', {}).pipe(
      catchError(() => of(null)),
      tap(() => this.clear()),
    );
  }

  private setToken(token: string) {
    this.token.set(token);
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* stockage indisponible : la session durera le temps de l'onglet */
    }
  }

  clear() {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
}
