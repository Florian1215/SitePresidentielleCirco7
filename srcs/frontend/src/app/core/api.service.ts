import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { Dict, fr } from '../i18n/fr';
import { ActionGroup, ApiCountry, Article, CampaignEvent, Category, FooterLinks, Paginated } from './models';

export interface ArticleQuery {
  page?: number;
  search?: string;
  category?: string;
  mine?: boolean;
  status?: string;
}

export interface ArticlePayload {
  title: string;
  excerpt: string;
  content: string;
  category: number | null;
  status: string;
  cover?: File | null;
  removeCover?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private footerLinks$?: Observable<FooterLinks>;
  private events$?: Observable<CampaignEvent[]>;

  articles(q: ArticleQuery = {}) {
    let params = new HttpParams();
    if (q.page && q.page > 1) params = params.set('page', q.page);
    if (q.search) params = params.set('search', q.search);
    if (q.category) params = params.set('category', q.category);
    if (q.mine) params = params.set('mine', '1');
    if (q.status) params = params.set('status', q.status);
    return this.http.get<Paginated<Article>>('/api/articles/', { params });
  }

  article(slug: string) {
    return this.http.get<Article>(`/api/articles/${encodeURIComponent(slug)}/`);
  }

  saveArticle(data: ArticlePayload, slug?: string) {
    const body = new FormData();
    body.append('title', data.title);
    body.append('excerpt', data.excerpt);
    body.append('content', data.content);
    body.append('category', data.category === null ? '' : String(data.category));
    body.append('status', data.status);
    if (data.cover) body.append('cover_image', data.cover);
    if (data.removeCover) body.append('remove_cover', 'true');
    return slug
      ? this.http.patch<Article>(`/api/articles/${encodeURIComponent(slug)}/`, body)
      : this.http.post<Article>('/api/articles/', body);
  }

  /** Image insérée dans le corps d'un article depuis l'éditeur. */
  uploadArticleImage(file: File) {
    const body = new FormData();
    body.append('image', file);
    return this.http.post<{ url: string }>('/api/articles/images/', body);
  }

  deleteArticle(slug: string) {
    return this.http.delete(`/api/articles/${encodeURIComponent(slug)}/`);
  }

  categories() {
    return this.http.get<Category[]>('/api/categories/');
  }

  countries() {
    return this.http.get<ApiCountry[]>('/api/countries/');
  }

  /** Prochains événements (calendrier Zetkin), partagés entre l'accueil et la page Agenda. */
  events() {
    return (this.events$ ??= this.http.get<CampaignEvent[]>('/api/events/').pipe(
      catchError(() => of<CampaignEvent[]>([])),
      shareReplay(1),
    ));
  }

  /** Nombre de soutiens à la candidature (compteur d'Action populaire, via le backend). */
  supportersCount() {
    return this.http.get<{ count: number | null }>('/api/supporters-count/');
  }

  actionGroups() {
    return this.http.get<ActionGroup[]>('/api/action-groups/');
  }

  /** Sites amis et réseaux sociaux (une seule requête, partagée par le pied de page et la page Contact). */
  footerLinks() {
    return (this.footerLinks$ ??= this.http.get<FooterLinks>('/api/footer-links/').pipe(
      catchError(() => of<FooterLinks>({ friend_sites: [], socials: [] })),
      shareReplay(1),
    ));
  }

  contact(data: Record<string, unknown>) {
    return this.http.post<{ detail: string }>('/api/contact/', data);
  }

  supporter(data: Record<string, unknown>) {
    return this.http.post<{ detail: string }>('/api/supporters/', data);
  }
}

/** Transforme une erreur DRF en message lisible (messages génériques dans la langue passée, français par défaut). */
export function apiErrorMessage(err: unknown, messages: Dict['errors'] = fr.errors): string {
  const e = err as { status?: number; error?: unknown };
  if (e?.status === 0) return messages.unreachable;
  if (e?.status === 429) return messages.tooMany;
  const body = e?.error;
  if (body && typeof body === 'object') {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
      const msg = Array.isArray(val) ? val.join(' ') : String(val);
      parts.push(key === 'detail' || key === 'non_field_errors' ? msg : `${key} : ${msg}`);
    }
    if (parts.length) return parts.join(' — ');
  }
  return messages.generic;
}
