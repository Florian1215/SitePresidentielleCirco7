import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  if (!token || !req.url.startsWith('/api/')) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Token ${token}` } })).pipe(
    catchError((err: unknown) => {
      // Jeton expiré ou révoqué : on se déconnecte et on rejoue la requête en anonyme.
      if (err instanceof HttpErrorResponse && err.status === 401) {
        auth.clear();
        return next(req);
      }
      return throwError(() => err);
    }),
  );
};
