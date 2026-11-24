export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  /** Admin du site : tous les droits sur le site, publie directement, sans validations. */
  is_admin: boolean;
  /** Membre du staff : peut nommer ou retirer des admins du site. */
  can_grant_admin: boolean;
  /** Accès à la page « Membres ». */
  can_manage_members: boolean;
  /** Page « Membres » : tous les comptes (admins) ou les demandes de son groupe d'action (gestionnaire de GA). */
  can_manage_requests: boolean;
  /** Accès à la page « Trackers » (admins et membres). */
  can_use_trackers: boolean;
  permissions: string[];
  /** Groupe d'action du compte ; `can_edit` : il peut modifier la page du groupe (membre ou admin). */
  action_group: { id: number; slug: string; name: string; can_edit: boolean } | null;
}

export type MemberStatus = 'pending' | 'active' | 'revoked';
/**
 * admin, animator (« Membre » : membre de groupe d'action : articles + page de son groupe), reviewer (relecteur·ice) ;
 * editor et none : anciens rôles, encore affichés.
 */
export type MemberRole = 'admin' | 'manager' | 'animator' | 'reviewer' | 'editor' | 'none';

/** Compte affiché sur la page « Membres ». */
export interface Member {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  status: MemberStatus;
  role: MemberRole;
  /** Groupe d'action choisi à l'inscription (null : aucun). */
  action_group: { id: number; name: string; city: string; country: string } | null;
  /** Accès à l'administration Django (/admin), géré seulement depuis /admin. */
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  is_self: boolean;
  /** Le compte connecté peut agir dessus (pas lui-même, pas un·e super-utilisateur·ice). */
  editable: boolean;
}

/** Lien de suivi (page « Trackers ») et ses visites, par langue du lien. */
export interface Tracker {
  id: number;
  name: string;
  code: string;
  created_at: string;
  total: number;
  counts: Record<'fr' | 'en' | 'de', number>;
  last_visit: string | null;
  /** Le compte peut renommer et supprimer ce tracker (son créateur·ice, ou un·e admin). */
  can_edit: boolean;
}

/** « Je m'engage » : formulaire Zetkin de chaque ville, et formulaire par défaut (admin Django ; null s'il n'y en a pas). */
export interface EngageForms {
  default_url: string | null;
  cities: { name: string; url: string | null }[];
}

/** Statistiques des visites (page « Trackers »). */
export interface VisitStats {
  total: number;
  today: number;
  last_7_days: number;
  last_30_days: number;
  /** Arrivées par un lien de suivi. */
  tracked: number;
  /** Arrivées sans lien de suivi… */
  untracked: number;
  /** … dont accès direct (adresse tapée, favori, application sans origine). */
  direct: number;
  by_lang: Record<'fr' | 'en' | 'de', number>;
  /** Origine des visites sans lien de suivi (Google, ChatGPT, nom du site…), la plus fréquente d'abord. */
  sources: { source: string; count: number }[];
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
  /** Groupe d'action au nom duquel l'article est publié (affiché sur la page du groupe). */
  action_group: number | null;
  action_group_detail: { id: number; slug: string; name: string } | null;
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
  /** Adresse de la page du groupe : /groupes/<slug>. */
  slug: string;
  /** Logo du groupe (null s'il n'en a pas). */
  logo: string | null;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  url: string;
  /** Réseaux sociaux du groupe (admin Django → Groupes d'action). */
  /** Tous affichés dans la bulle de la carte ; `show_in_list` : aussi dans la liste des groupes. */
  links: { network: string; url: string; show_in_list: boolean }[];
  /** Ville de l'agenda auquel s'abonner pour ce groupe (null si aucune à proximité) et son identifiant d'adresse. */
  calendar_city: string | null;
  calendar_slug: string | null;
}

/** Lien d'un groupe vers un réseau social. */
export type ActionGroupLink = ActionGroup['links'][number];

/** Photo de la page d'un groupe d'action. */
export interface GroupPhoto {
  id: number;
  url: string;
  caption: string;
  created_at: string;
}

/** Page d'un groupe d'action (/groupes/:slug). */
export interface ActionGroupDetail extends ActionGroup {
  description: string;
  /** Logo du groupe (page du groupe, stickers QR code), null s'il n'y en a pas. */
  logo: string | null;
  /** Image d'en-tête de la page du groupe, null s'il n'y en a pas. */
  cover: string | null;
  photos: GroupPhoto[];
  /** Prochains événements de la ville de l'agenda du groupe. */
  events: CampaignEvent[];
  /** Lien du bouton « Je m'engage » : formulaire de la ville du groupe, sinon formulaire par défaut (null : aucun). */
  engage_url: string | null;
  engage_url_is_default: boolean;
  /** Le compte connecté peut modifier la page (membre du groupe, admin). */
  can_edit: boolean;
  /** Visites de la page (null : seulement pour qui peut la modifier). */
  visits: GroupVisits | null;
}

export interface GroupVisits {
  total: number;
  last_7_days: number;
  last_30_days: number;
  by_lang: Record<'fr' | 'en' | 'de', number>;
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
