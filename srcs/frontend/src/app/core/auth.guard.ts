import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** Autorise l'accès si l'utilisateur possède la permission Django donnée. */
export function permissionGuard(perm: string): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const check = () =>
      auth.isLoggedIn()
        ? auth.hasPerm(perm) || router.createUrlTree(['/blog'])
        : router.createUrlTree(['/connexion'], { queryParams: { next: state.url } });
    return auth.loaded() ? of(check()) : auth.restore().pipe(map(check));
  };
}
