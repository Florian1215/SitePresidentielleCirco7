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

export type ArticleStatus = 'draft' | 'pending' | 'published';

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
  /** Noms des comptes ayant validé l'article (statut « pending »). */
  approvals: string[];
  approvals_required: number;
  can_approve: boolean;
  is_author: boolean;
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

/** Question fréquente de la page « Voter » (admin Django → Questions fréquentes), dans les trois langues. */
export interface FaqEntry {
  id: number;
  question_fr: string;
  answer_fr: string;
  question_en: string;
  answer_en: string;
  question_de: string;
  answer_de: string;
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
  /** Réseaux sociaux du groupe (admin Django → Groupes d'action). */
  links: { network: string; url: string }[];
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
  /** Catégorie : le nom du projet Zetkin de l'événement (« Réunions publiques »…). */
  category: string;
}

/** Bureau de vote affiché sur la carte de la page Voter (admin Django → Bureaux de vote). */
export interface PollingStation {
  id: number;
  name: string;
  /** Adresse postale, éventuellement sur plusieurs lignes. */
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Informations pratiques (horaires, accès…), facultatives. */
  info: string;
  /** Page du consulat, facultative. */
  url: string;
}
