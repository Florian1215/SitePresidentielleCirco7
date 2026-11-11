import { Routes } from '@angular/router';
import { permissionGuard } from './core/auth.guard';

// `title` : clé de traduction (i18n `titles`), ou texte fixe pour l'espace rédaction (en français)
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home), title: 'home' },
  { path: 'programme', loadComponent: () => import('./pages/programme/programme').then((m) => m.Programme), title: 'programme' },
  { path: 'circonscription', loadComponent: () => import('./pages/circonscription/circonscription').then((m) => m.Circonscription), title: 'circonscription' },
  { path: 'inscription-listes-electorales', loadComponent: () => import('./pages/voter/voter').then((m) => m.Voter), title: 'voter' },
  { path: 'agenda', redirectTo: 'blog' },
  { path: 'blog', loadComponent: () => import('./pages/blog-list/blog-list').then((m) => m.BlogList), title: 'blog' },
  {
    path: 'blog/ecrire',
    canActivate: [permissionGuard('blog.add_article')],
    loadComponent: () => import('./pages/article-editor/article-editor').then((m) => m.ArticleEditor),
    title: 'Écrire un article',
  },
  {
    path: 'blog/:slug/modifier',
    canActivate: [permissionGuard('blog.change_article')],
    loadComponent: () => import('./pages/article-editor/article-editor').then((m) => m.ArticleEditor),
    title: "Modifier l'article",
  },
  { path: 'blog/:slug', loadComponent: () => import('./pages/article/article').then((m) => m.ArticlePage) },
  { path: 'contact', loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact), title: 'contact' },
  { path: 'connexion', loadComponent: () => import('./pages/login/login').then((m) => m.Login), title: 'Connexion' },
  { path: 'mentions-legales', loadComponent: () => import('./pages/legal/legal').then((m) => m.Legal), title: 'legal' },
  { path: '**', loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound), title: 'notFound' },
];
