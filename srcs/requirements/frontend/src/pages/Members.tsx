import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, apiErrorMessage } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { Member, MemberRole, MemberStatus } from '../lib/models';
import { refreshPendingMembers } from '../lib/pending';
import { usePageTitle } from '../lib/title';

/** Filtres d'état (paramètre d'adresse ?statut=…). */
const FILTERS: { key: string; label: string; status?: MemberStatus }[] = [
  { key: '', label: 'Demandes en attente', status: 'pending' },
  { key: 'actifs', label: 'Membres actifs', status: 'active' },
  { key: 'retires', label: 'Accès retirés', status: 'revoked' },
  { key: 'tous', label: 'Tous' },
];

const ROLES: { value: Exclude<MemberRole, 'admin'>; label: string; hint: string }[] = [
  { value: 'writer', label: 'Rédacteur·ice', hint: 'écrit des articles et valide ceux des autres' },
  { value: 'editor', label: 'Éditeur·ice', hint: 'peut aussi modifier et supprimer tous les articles' },
  { value: 'none', label: 'Membre (sans droit d’écrire)', hint: 'peut seulement se connecter' },
];

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: 'Administrateur·ice',
  editor: 'Éditeur·ice',
  writer: 'Rédacteur·ice',
  none: 'Membre',
};

const STATUS_BADGE: Record<MemberStatus, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'badge badge-pending' },
  active: { label: 'Actif', className: 'badge bg-vert! text-white!' },
  revoked: { label: 'Accès retiré', className: 'badge badge-draft' },
};

const CHIP = 'cursor-pointer rounded-full border-2 px-3.5 py-1.5 [font-family:inherit] text-[14px] font-bold';
const chip = (on: boolean) =>
  `${CHIP} ${on ? 'border-violet bg-violet text-creme' : 'border-violet bg-white text-violet hover:bg-lavande'}`;

const fullName = (m: Member) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;

/** Recherche sans tenir compte des accents ni de la casse. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Page « Membres » (administrateur·ices) : demandes de compte à accepter ou refuser,
 * rôle de chaque membre, retrait et rétablissement de l'accès.
 */
export default function Members() {
  usePageTitle('Membres — espace rédaction');
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.key === (params.get('statut') ?? '')) ?? FILTERS[0];
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

  const setFilter = (key: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (key) next.set('statut', key);
        else next.delete('statut');
        return next;
      },
      { replace: true },
    );

  const counts = useMemo(
    () =>
      Object.fromEntries(FILTERS.map((f) => [f.key, (members ?? []).filter((m) => !f.status || m.status === f.status).length])),
    [members],
  );

  const q = fold(query.trim());
  const shown = (members ?? []).filter(
    (m) => (!filter.status || m.status === filter.status) && (!q || fold(`${fullName(m)} ${m.username}`).includes(q)),
  );

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
      <div className="site-container">
        <div className="mb-6">
          <span className="eyebrow">Espace rédaction</span>
          <h1 className="h2 m-0">Membres</h1>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par état">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={chip(filter.key === f.key)}
              aria-pressed={filter.key === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {members && <span className="ml-1.5 opacity-70">{counts[f.key]}</span>}
            </button>
          ))}
        </div>

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

        {filter.status === 'pending' && (
          <p className="muted mt-0 mb-6 text-[15px]">
            Ces personnes ont demandé un compte depuis la page « Se connecter ». Acceptez-les avec le rôle voulu, ou refusez la
            demande (elle est alors supprimée).
          </p>
        )}

        {error ? (
          <div className="alert alert-err">Impossible de charger les membres.</div>
        ) : members === null ? (
          <p className="loader">Chargement…</p>
        ) : !shown.length ? (
          <div className="card text-center">
            <p className="m-0 font-bold">
              {filter.status === 'pending' && !q ? 'Aucune demande en attente.' : 'Aucun membre ici.'}
            </p>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {shown.map((m) => (
              <li key={m.id}>
                <MemberRow member={m} onChange={replace} onRemoved={() => removed(m.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function MemberRow({ member: m, onChange, onRemoved }: { member: Member; onChange: (m: Member) => void; onRemoved: () => void }) {
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<'refuse' | 'revoke' | null>(null);
  /** Rôle donné à l'acceptation d'une demande. */
  const [acceptRole, setAcceptRole] = useState<MemberRole>('writer');
  const badge = STATUS_BADGE[m.status];

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
      {ROLES.map((r) => (
        <option key={r.value} value={r.value} title={r.hint}>
          {r.label}
        </option>
      ))}
    </select>
  );

  return (
    <article className="card-flat flex flex-wrap items-center gap-x-6 gap-y-3 p-4!">
      <div className="min-w-[220px] flex-1">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <strong className="text-[17px] text-violet">{fullName(m)}</strong>
          <span className={badge.className}>{badge.label}</span>
          {m.is_self && <span className="badge">Vous</span>}
        </p>
        <p className="m-0 mt-1 text-[13px] text-texte">
          {m.username} · {m.status === 'pending' ? 'demande du' : 'compte créé le'} {i18n.date(m.date_joined)}
          {m.last_login && ` · dernière connexion le ${i18n.date(m.last_login)}`}
        </p>
      </div>

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
          {m.role === 'admin' || !m.editable ? (
            <span className="badge">{ROLE_LABEL[m.role]}</span>
          ) : (
            <>
              <label htmlFor={`role-${m.id}`} className="visually-hidden">
                Rôle de {fullName(m)}
              </label>
              {roleSelect(m.role, (r) => run(() => api.setMemberRole(m.id, r)), `role-${m.id}`)}
            </>
          )}
          {m.editable &&
            (m.status === 'revoked' ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={busy}
                onClick={() => run(() => api.memberAction(m.id, 'restore'))}
              >
                Rétablir l'accès
              </button>
            ) : confirming === 'revoke' ? (
              <>
                <span className="text-[14px] font-bold text-rouge">Retirer l'accès ?</span>
                <button
                  type="button"
                  className="btn btn-rouge btn-sm"
                  disabled={busy}
                  onClick={() => run(() => api.memberAction(m.id, 'revoke'))}
                >
                  Oui
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(null)}>
                  Non
                </button>
              </>
            ) : (
              <button type="button" className="btn-link text-[14px] font-bold text-rouge" onClick={() => setConfirming('revoke')}>
                Retirer l'accès
              </button>
            ))}
        </div>
      )}

      {error && (
        <div className="alert alert-err m-0 w-full" role="alert">
          {error}
        </div>
      )}
    </article>
  );
}
