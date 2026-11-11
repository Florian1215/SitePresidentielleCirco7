export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  permissions: string[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export type ArticleStatus = 'draft' | 'published';

export interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  cover_image: string | null;
  category: number | null;
  category_detail: Category | null;
  author_name: string;
  status: ArticleStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiCountry {
  code: string;
  name: string;
}

/** Liens du pied de page, gérés dans l'admin Django (Sites amis, Réseaux sociaux). */
export interface FriendSite {
  id: number;
  name: string;
  url: string;
}

export interface SocialLink {
  id: number;
  network: string;
  label: string;
  url: string;
}

export interface FooterLinks {
  friend_sites: FriendSite[];
  socials: SocialLink[];
}

/** Groupe d'action affiché sur la carte (admin Django → Groupes d'action). */
export interface ActionGroup {
  id: number;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  url: string;
}

/** Événement de l'agenda, lu par le backend dans le calendrier Zetkin. Heures = heure locale du lieu. */
export interface CampaignEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  /** Ville déduite des coordonnées ou du titre (« En ligne » sans lieu), null si inconnue. */
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  url: string;
  image: string | null;
}
