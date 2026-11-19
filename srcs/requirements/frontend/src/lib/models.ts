export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  /** Administrateur·ice principal·e : publie directement, sans validations. */
  is_superuser: boolean;
  /** Accès à la page « Membres ». */
  can_manage_members: boolean;
  permissions: string[];
}

export type MemberStatus = 'pending' | 'active' | 'revoked';
/** admin, writer (rédacteur·ice), reviewer (relecteur·ice) ; editor et none : anciens rôles, encore affichés. */
export type MemberRole = 'admin' | 'writer' | 'reviewer' | 'editor' | 'none';

/** Compte affiché sur la page « Membres ». */
export interface Member {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  status: MemberStatus;
  role: MemberRole;
  is_staff: boolean;
  date_joined: string;
  last_login: string | null;
  is_self: boolean;
  /** Le compte connecté peut agir dessus (pas lui-même, pas un·e super-utilisateur·ice). */
  editable: boolean;
}

/** Signataire possible d'un article : compte rédacteur ou signature collective. */
export interface Signer {
  id: number;
  name: string;
}

export interface Signers {
  authors: Signer[];
  collectives: Signer[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  /** Nombre d'articles (seulement pour les comptes qui gèrent les catégories). */
  article_count?: number | null;
}

/** Signature collective (« Berlin Insoumise »…), gérée par les administrateur·ices. */
export interface CollectiveAuthor {
  id: number;
  name: string;
  article_count?: number | null;
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
  /** Signature affichée (« Berlin Insoumise, Alice et Bob »). */
  author_name: string;
  authors_detail: Signer[];
  collectives_detail: Signer[];
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
  /** Bouton « Publier maintenant » (administrateur·ice principal·e, article non publié). */
  can_publish_now: boolean;
  /** Commentaires de relecture (null : le compte ne peut pas les voir). */
  comments_count: number | null;
  /** Dont ceux qui attendent une réponse de l'auteur·ice. */
  open_comments_count: number | null;
  can_comment: boolean;
}

/** Suite donnée à un commentaire de relecture par l'auteur·ice de l'article. */
export type ReviewCommentStatus = 'open' | 'done' | 'declined';

/** Commentaire de relecture (« attention, faute ici »…) laissé pendant la validation d'un article. */
export interface ReviewComment {
  id: number;
  text: string;
  status: ReviewCommentStatus;
  author_name: string;
  is_mine: boolean;
  created_at: string;
  /** Auteur·ices de l'article : indiquer « pris en compte » ou non. */
  can_set_status: boolean;
  /** Son propre commentaire, tant qu'il n'a pas reçu de réponse. */
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
