import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18n } from './i18n';

/** Envoie la langue choisie au serveur : Django traduit alors ses messages standard (validation…). */
export const i18nInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  return next(req.clone({ setHeaders: { 'Accept-Language': inject(I18n).lang() } }));
};
