import { useEffect, useMemo, useRef, useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import type { Member, MemberRole, MemberStatus } from '../lib/models';
import { refreshPendingMembers } from '../lib/pending';
import { usePageTitle } from '../lib/title';

/** Les droits attribuables (un·e gestionnaire de GA ne donne que « Membre » ou « Relecteur·ice »). */
const ROLES: { value: MemberRole; label: string; hint: string }[] = [
  {
    value: 'admin',
    label: 'Admin',
    hint: 'tous les droits sur le site : articles, publication directe, membres, catégories (sans accès à /admin)',
  },
  {
    value: 'manager',
    label: 'Gestionnaire du GA',
    hint: "comme Membre, et accepte ou refuse les demandes de compte des personnes de son groupe d'action",
  },
  {
    value: 'animator',
    label: 'Membre',
    hint: "écrit et valide des articles, et modifie la page de son groupe d'action (réseaux, lien « Je m'engage », photos)",
  },
  { value: 'reviewer', label: 'Relecteur·ice', hint: 'valide seulement les articles des autres' },
];

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: 'Admin',
  manager: 'Gestionnaire du GA',
  animator: 'Membre',
  reviewer: 'Relecteur·ice',
  editor: 'Éditeur·ice (ancien rôle)',
  none: 'Aucun droit',
};

const STATUS_BADGE: Record<MemberStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'badge badge-pending' },
  active: { label: 'Actif', className: 'badge bg-vert! text-white!' },
  revoked: { label: 'Accès retiré', className: 'badge badge-draft' },
};

/** Ordre de la liste : demandes en attente d'abord, puis membres actifs, puis accès retirés. */
const STATUS_ORDER: Record<MemberStatus, number> = { pending: 0, active: 1, revoked: 2 };

const fullName = (m: Member) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;

/** Recherche sans tenir compte des accents ni de la casse. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Page « Membres » (administrateur·ices) : la liste de tous les comptes, avec une recherche.
 * À droite de chaque membre : son statut et les actions (accepter / refuser une demande, rôle, retirer ou rétablir l'accès).
 */
export default function Members() {
  usePageTitle('Membres — espace rédaction');
  const i18n = useI18n();
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    api.members(ctrl.signal).then(setMembers, (err) => {
      if ((err as Error)?.name !== 'AbortError') setError(true);
    });
    return () => ctrl.abort();
  }, []);

  const q = fold(query.trim());
  // Tri stable : l'ordre du serveur (comptes les plus récents d'abord) est conservé dans chaque statut
  const shown = (members ?? [])
    .filter((m) => !q || fold(`${fullName(m)} ${m.username} ${m.email}`).includes(q))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  /**
   * Comptes rangés par groupe d'action (ordre alphabétique), ceux sans groupe à la fin. Dans chaque groupe, les
   * demandes en attente d'abord (pastille rouge sur le titre du groupe).
   */
  const sections = useMemo(() => {
    const byGroup = new Map<number | null, Member[]>();
    for (const m of shown) {
      const key = m.action_group?.id ?? null;
      byGroup.set(key, [...(byGroup.get(key) ?? []), m]);
    }
    return [...byGroup.values()]
      .map((list) => ({
        group: list[0].action_group,
        list,
        pending: list.filter((m) => m.status === 'pending').length,
      }))
      .sort((a, b) => (!a.group ? 1 : !b.group ? -1 : i18n.compare(a.group.name, b.group.name)));
  }, [shown, i18n]);

  const replace = (updated: Member) => {
    setMembers((list) => list?.map((m) => (m.id === updated.id ? updated : m)) ?? null);
    refreshPendingMembers();
  };
  const removed = (id: number) => {
    setMembers((list) => list?.filter((m) => m.id !== id) ?? null);
    refreshPendingMembers();
  };

  return (
    <section className="section-sm">
      <div className="site-container max-w-[1000px]">
        <h1 className="h2 mb-6">Membres</h1>
        <div className="field mb-6 max-w-[420px]">
          <label htmlFor="members-search" className="visually-hidden">
            Rechercher un membre
          </label>
          <input
            id="members-search"
            type="search"
            placeholder="Rechercher par nom…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {error ? (
          <div className="alert alert-err">Impossible de charger les membres.</div>
        ) : members === null ? (
          <p className="loader">Chargement…</p>
        ) : !shown.length ? (
          <p className="m-0 font-bold">Aucun membre trouvé.</p>
        ) : (
          <div className="stack gap-8!">
            {sections.length > 0 && (
              <div className="stack gap-5!">
                {sections.map(({ group, list, pending }) => (
                  // Fermé par défaut ; ouvert s'il a des demandes en attente, et pendant une recherche
                  <details key={`${group?.id ?? 'aucun'}-${q ? 'q' : ''}`} open={!!q || pending > 0} className="group/ga">
                    <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 border-b-2 border-violet py-2 [&::-webkit-details-marker]:hidden">
                      <span
                        className="inline-block w-4 text-[18px] text-rouge transition-transform duration-150 group-open/ga:rotate-90"
                        aria-hidden="true"
                      >
                        ▸
                      </span>
                      <h2 className="m-0 inline text-[24px]">{group ? group.name : 'Sans groupe d’action'}</h2>
                      {pending > 0 && (
                        <span
                          className="inline-grid h-6 min-w-6 place-items-center self-center rounded-full bg-rouge px-1.5 text-[13px] font-bold text-white"
                          title={`${pending} demande${pending > 1 ? 's' : ''} en attente`}
                        >
                          {pending}
                          <span className="sr-only"> demande{pending > 1 ? 's' : ''} en attente</span>
                        </span>
                      )}
                      <span className="text-[14px] font-normal text-texte">
                        {group && [group.city, i18n.country(group.country)].filter(Boolean).join(', ') + ' · '}
                        {list.length - pending} membre{list.length - pending > 1 ? 's' : ''}
                      </span>
                    </summary>
                    <div className="mt-3 pl-6 max-[700px]:pl-3">
                      <MemberList list={list} onChange={replace} onRemoved={removed} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MemberList({
  list,
  onChange,
  onRemoved,
}: {
  list: Member[];
  onChange: (m: Member) => void;
  onRemoved: (id: number) => void;
}) {
  return (
    <ul className="m-0 list-none divide-y divide-gris overflow-hidden rounded-site border border-gris bg-white p-0">
      {list.map((m) => (
        <li key={m.id}>
          <MemberRow member={m} onChange={onChange} onRemoved={() => onRemoved(m.id)} />
        </li>
      ))}
    </ul>
  );
}

function MemberRow({ member: m, onChange, onRemoved }: { member: Member; onChange: (m: Member) => void; onRemoved: () => void }) {
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<'refuse' | 'revoke' | 'admin' | null>(null);
  const auth = useAuth();
  /** Seul·es les membres du staff peuvent nommer un·e admin. */
  const canGrantAdmin = auth.canGrantAdmin;
  /** Gestionnaire de GA (pas admin) : accepte seulement comme membre ou relecteur·ice. */
  const roles = auth.canManageMembers ? ROLES : ROLES.filter((r) => r.value === 'animator' || r.value === 'reviewer');
  /** Rôle donné à l'acceptation d'une demande. */
  const [acceptRole, setAcceptRole] = useState<MemberRole>('animator');
  const badge = STATUS_BADGE[m.status];
  /** Lien « nouveau mot de passe » créé pour ce membre (affiché sous son nom). */
  const [resetLink, setResetLink] = useState<{ url: string; days: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const createResetLink = async () => {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      const { uid, token, valid_days } = await api.memberResetLink(m.id);
      setResetLink({ url: `${window.location.origin}/mot-de-passe/${uid}/${token}`, days: valid_days });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink.url);
      setCopied(true);
    } catch {
      /* presse-papiers indisponible : le lien reste sélectionnable dans le champ */
    }
  };

  const run = async (call: () => Promise<Member | null>) => {
    setBusy(true);
    setError('');
    try {
      const updated = await call();
      if (updated) onChange(updated);
      else onRemoved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const roleSelect = (value: MemberRole, onSelect: (r: MemberRole) => void, id: string) => (
    <select
      id={id}
      className="w-auto! py-1.5! text-[14px]"
      value={value}
      disabled={busy}
      onChange={(e) => onSelect(e.target.value as MemberRole)}
    >
      {/* Ancien rôle (éditeur·ice, aucun droit) : affiché tant qu'on n'en a pas choisi un des trois */}
      {!roles.some((r) => r.value === value) && (
        <option value={value} disabled>
          {ROLE_LABEL[value]}
        </option>
      )}
      {roles.map((r) => (
        <option key={r.value} value={r.value} title={r.hint} disabled={r.value === 'admin' && !canGrantAdmin}>
          {r.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
      <div className="min-w-[200px] flex-1">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <strong className="text-[17px] text-violet">{fullName(m)}</strong>
          {m.is_self && <span className="badge">Vous</span>}
        </p>
        <p className="m-0 mt-1 text-[13px] text-texte">
          {m.username}
          {m.email && <> · {m.email}</>} · {m.status === 'pending' ? 'demande du' : 'compte créé le'} {i18n.date(m.date_joined)}
          {m.last_login && ` · dernière connexion le ${i18n.date(m.last_login)}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 max-[700px]:w-full max-[700px]:justify-start">
        {m.is_staff && (
          <span className="badge" title="Accès à l'administration Django (/admin)">
            {m.is_superuser ? 'Super-admin' : 'Staff'}
          </span>
        )}
        {m.status !== 'active' && <span className={badge.className}>{badge.label}</span>}
        {m.status === 'pending' ? (
          m.editable && (
            <div className="flex flex-wrap items-center gap-2">
              {confirming === 'refuse' ? (
                <>
                  <span className="text-[14px] font-bold text-rouge">Refuser et supprimer la demande ?</span>
                  <button
                    type="button"
                    className="btn btn-rouge btn-sm"
                    disabled={busy}
                    onClick={() => run(() => api.refuseMember(m.id).then(() => null))}
                  >
                    Oui
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(null)}>
                    Non
                  </button>
                </>
              ) : (
                <>
                  <label htmlFor={`role-new-${m.id}`} className="visually-hidden">
                    Rôle à l'acceptation
                  </label>
                  {roleSelect(acceptRole, setAcceptRole, `role-new-${m.id}`)}
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => run(() => api.memberAction(m.id, 'accept', acceptRole))}
                  >
                    ✓ Accepter
                  </button>
                  <button
                    type="button"
                    className="btn-link text-[14px] font-bold text-rouge"
                    onClick={() => setConfirming('refuse')}
                  >
                    Refuser
                  </button>
                </>
              )}
            </div>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {!m.editable ? (
              <span className="badge">{ROLE_LABEL[m.role]}</span>
            ) : (
              <>
                <label htmlFor={`role-${m.id}`} className="visually-hidden">
                  Rôle de {fullName(m)}
                </label>
                {roleSelect(
                  m.role,
                  (r) => (r === 'admin' ? setConfirming('admin') : run(() => api.setMemberRole(m.id, r))),
                  `role-${m.id}`,
                )}
              </>
            )}
            {m.editable &&
              (confirming === 'admin' ? (
                <>
                  <span className="text-[14px] font-bold text-rouge">Donner tous les droits (admin) ?</span>
                  <button
                    type="button"
                    className="btn btn-rouge btn-sm"
                    disabled={busy}
                    onClick={() => run(() => api.setMemberRole(m.id, 'admin'))}
                  >
                    Oui
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(null)}>
                    Non
                  </button>
                </>
              ) : m.status === 'revoked' ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => run(() => api.memberAction(m.id, 'restore'))}
                >
                  Rétablir l'accès
                </button>
              ) : (
                <span className="flex items-center gap-1">
                  {!resetLink && (
                    <button
                      type="button"
                      className={ICON_BTN + ' text-violet hover:bg-lavande'}
                      disabled={busy}
                      onClick={createResetLink}
                      title="Réinitialiser le mot de passe"
                      aria-label={`Réinitialiser le mot de passe de ${fullName(m)}`}
                    >
                      <KeyIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    className={ICON_BTN + ' text-rouge hover:bg-rouge/10'}
                    disabled={busy}
                    onClick={() => setConfirming('revoke')}
                    title="Retirer l'accès"
                    aria-label={`Retirer l'accès de ${fullName(m)}`}
                  >
                    <RevokeIcon />
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>

      {resetLink && (
        <div className="grid w-full gap-2 rounded-lg bg-lavande p-3">
          <label htmlFor={`reset-${m.id}`} className="text-[14px] font-bold text-violet">
            Lien à envoyer à {m.first_name || fullName(m)} pour choisir un nouveau mot de passe
          </label>
          <div className="flex gap-2 max-[520px]:flex-col">
            <input
              id={`reset-${m.id}`}
              type="text"
              readOnly
              value={resetLink.url}
              className="min-w-0 flex-1 bg-white text-[14px]"
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="btn btn-sm shrink-0" onClick={copyResetLink}>
              {copied ? '✓ Copié' : 'Copier le lien'}
            </button>
          </div>
          <p className="m-0 flex flex-wrap items-center gap-x-3 text-[13px] text-texte">
            Valable {resetLink.days} jours, une seule fois.
            <button type="button" className="btn-link text-[13px]" onClick={() => setResetLink(null)}>
              Fermer
            </button>
          </p>
        </div>
      )}

      <RevokeDialog
        member={confirming === 'revoke' ? m : null}
        busy={busy}
        onConfirm={() => run(() => api.memberAction(m.id, 'revoke'))}
        onClose={() => setConfirming(null)}
      />

      {error && (
        <div className="alert alert-err m-0 w-full" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

const ICON_BTN =
  'grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent focus-visible:outline-3 focus-visible:outline-jaune disabled:opacity-50';

/** Clé (Font Awesome, licence CC BY 4.0). */
function KeyIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <path d="M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0S160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17v80c0 13.3 10.7 24 24 24h80c13.3 0 24-10.7 24-24V448h40c13.3 0 24-10.7 24-24V384h40c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zM376 96a40 40 0 1 1 0 80 40 40 0 1 1 0-80z" />
    </svg>
  );
}

/** Sens interdit : retirer l'accès. */
function RevokeIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M5.7 5.7l12.6 12.6" />
    </svg>
  );
}

/** Fenêtre de confirmation « Retirer l'accès » ; `member` null = fermée. */
function RevokeDialog({
  member,
  busy,
  onConfirm,
  onClose,
}: {
  member: Member | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (member && !d.open) d.showModal();
    else if (!member && d.open) d.close();
  }, [member]);

  return (
    <dialog
      ref={dialog}
      className="m-auto w-[min(440px,calc(100vw-24px))] max-w-none rounded-site border-0 bg-creme p-0 shadow-site backdrop:bg-noir/60"
      aria-labelledby="revoke-title"
      onClose={onClose}
      onClick={(e) => {
        // Clic sur le fond (en dehors de la fenêtre) : fermeture
        if (e.target === dialog.current) dialog.current?.close();
      }}
    >
      {member && (
        <div className="grid gap-4 p-[clamp(18px,4vw,28px)]">
          <h2 id="revoke-title" className="m-0 text-[24px]">
            Retirer l’accès de {fullName(member)} ?
          </h2>
          <p className="m-0">
            Ce compte sera déconnecté immédiatement et ne pourra plus se connecter. Ses articles restent en ligne, et vous pourrez
            rétablir l’accès à tout moment.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => dialog.current?.close()}>
              Annuler
            </button>
            <button type="button" className="btn btn-rouge btn-sm" disabled={busy} onClick={onConfirm}>
              Retirer l’accès
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
