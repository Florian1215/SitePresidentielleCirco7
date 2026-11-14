import { fr } from '../i18n/fr';
import type { Dict } from '../i18n/fr';
import { authStore, clearAuth } from './auth';
import { langStore } from './i18n';
import type { ActionGroup, ApiCountry, Article, CampaignEvent, Category, FooterLinks, Paginated, PollingStation } from './models';

/** Erreur d'appel à l'API : `status` 0 = serveur injoignable, `error` = corps de la réponse (erreurs DRF). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly error: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

type Init = { method?: string; body?: BodyInit | Record<string, unknown>; params?: Record<string, string>; signal?: AbortSignal };

/**
 * Appel à l'API Django :
 *   - envoie la langue choisie (Django traduit alors ses messages standard : validation…) ;
 *   - ajoute le jeton de connexion ; s'il est refusé (expiré, révoqué), on se déconnecte
 *     et on rejoue la requête en anonyme.
 */
export async function request<T>(url: string, init: Init = {}): Promise<T> {
  const query = init.params && Object.keys(init.params).length ? '?' + new URLSearchParams(init.params) : '';
  const isJson = init.body !== undefined && !(init.body instanceof FormData);
  const send = async (withToken: boolean) => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (url.startsWith('/api/')) headers['Accept-Language'] = langStore.get();
    if (isJson) headers['Content-Type'] = 'application/json';
    const token = authStore.get().token;
    if (withToken && token && url.startsWith('/api/')) headers['Authorization'] = `Token ${token}`;
    try {
      return await fetch(url + query, {
        method: init.method ?? 'GET',
        headers,
        body: isJson ? JSON.stringify(init.body) : (init.body as BodyInit | undefined),
        signal: init.signal,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      throw new ApiError(0, null);
    }
  };

  const hadToken = !!authStore.get().token;
  let res = await send(true);
  if (res.status === 401 && hadToken) {
    clearAuth();
    res = await send(false);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

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

let footerLinks$: Promise<FooterLinks> | undefined;
let events$: Promise<CampaignEvent[]> | undefined;

export const api = {
  articles(q: ArticleQuery = {}, signal?: AbortSignal) {
    const params: Record<string, string> = {};
    if (q.page && q.page > 1) params['page'] = String(q.page);
    if (q.search) params['search'] = q.search;
    if (q.category) params['category'] = q.category;
    if (q.mine) params['mine'] = '1';
    if (q.status) params['status'] = q.status;
    return request<Paginated<Article>>('/api/articles/', { params, signal });
  },

  article(slug: string, signal?: AbortSignal) {
    return request<Article>(`/api/articles/${encodeURIComponent(slug)}/`, { signal });
  },

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
      ? request<Article>(`/api/articles/${encodeURIComponent(slug)}/`, { method: 'PATCH', body })
      : request<Article>('/api/articles/', { method: 'POST', body });
  },

  /** Image insérée dans le corps d'un article depuis l'éditeur. */
  uploadArticleImage(file: File) {
    const body = new FormData();
    body.append('image', file);
    return request<{ url: string }>('/api/articles/images/', { method: 'POST', body });
  },

  deleteArticle(slug: string) {
    return request<unknown>(`/api/articles/${encodeURIComponent(slug)}/`, { method: 'DELETE' });
  },

  categories() {
    return request<Category[]>('/api/categories/');
  },

  countries() {
    return request<ApiCountry[]>('/api/countries/');
  },

  /** Prochains événements (calendrier Zetkin), partagés entre l'accueil et la page Agenda. */
  events() {
    return (events$ ??= request<CampaignEvent[]>('/api/events/').catch(() => []));
  },

  /** Nombre de soutiens à la candidature (compteur d'Action populaire, via le backend). */
  supportersCount() {
    return request<{ count: number | null }>('/api/supporters-count/');
  },

  actionGroups() {
    return request<ActionGroup[]>('/api/action-groups/');
  },

  /** Bureaux de vote affichés sur la carte de la page Voter. */
  pollingStations() {
    return request<PollingStation[]>('/api/polling-stations/');
  },

  /** Sites amis et réseaux sociaux (une seule requête, partagée par le pied de page et la page Contact). */
  footerLinks() {
    return (footerLinks$ ??= request<FooterLinks>('/api/footer-links/').catch(() => ({ friend_sites: [], socials: [] })));
  },

  contact(data: Record<string, unknown>) {
    return request<{ detail: string }>('/api/contact/', { method: 'POST', body: data });
  },

  supporter(data: Record<string, unknown>) {
    return request<{ detail: string }>('/api/supporters/', { method: 'POST', body: data });
  },
};

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
