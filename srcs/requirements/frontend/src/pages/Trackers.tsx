import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { QrLink } from '../components/QrLink';
import { api, apiErrorMessage } from '../lib/api';
import { LANGS, useI18n } from '../lib/i18n';
import type { Tracker, VisitStats } from '../lib/models';
import { usePageTitle } from '../lib/title';
import { trackerUrl } from '../lib/tracker';

/**
 * Page « Trackers » (administrateur·ices) : liens de suivi à mettre sur une affiche, un tract, un post…
 * Chaque tracker a un lien par langue ; on y voit le nombre de visites arrivées par chaque lien.
 * En haut : toutes les visites du site, par langue et par origine (Google, ChatGPT, réseaux sociaux…).
 */
export default function Trackers() {
  usePageTitle('Trackers — espace rédaction');
  const [trackers, setTrackers] = useState<Tracker[] | null>(null);
  const [error, setError] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  /** Tracker qui vient d'être créé : mis en avant dans la liste. */
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  const loadStats = useCallback((signal?: AbortSignal) => {
    return api.visitStats(signal).then(
      (s) => {
        setStats(s);
        setStatsError(false);
      },
      (err) => {
        if ((err as Error)?.name !== 'AbortError') setStatsError(true);
      },
    );
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) => {
      return Promise.all([
        api.trackers(signal).then(
          (list) => {
            setTrackers(list);
            setError(false);
          },
          (err) => {
            if ((err as Error)?.name !== 'AbortError') setError(true);
          },
        ),
        loadStats(signal),
      ]);
    },
    [loadStats],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const tracker = await api.createTracker(name.trim());
      setTrackers((list) => [tracker, ...(list ?? [])]);
      setCreatedId(tracker.id);
      setName('');
    } catch (err) {
      setCreateError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const replace = (updated: Tracker) => setTrackers((list) => list?.map((t) => (t.id === updated.id ? updated : t)) ?? null);
  const removed = (id: number) => {
    setTrackers((list) => list?.filter((t) => t.id !== id) ?? null);
    loadStats(); // les visites du tracker sont supprimées avec lui
  };

  const total = (trackers ?? []).reduce((sum, t) => sum + t.total, 0);

  return (
    <section className="section-sm">
      <div className="site-container max-w-[1000px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="h2 m-0">Trackers</h1>
          </div>
          <button type="button" className="btn btn-outline btn-sm" disabled={refreshing} onClick={refresh}>
            {refreshing ? 'Actualisation…' : '↻ Actualiser'}
          </button>
        </div>

        {statsError ? (
          <div className="alert alert-err mb-8">Impossible de charger les visites.</div>
        ) : (
          stats && <SiteVisits stats={stats} />
        )}

        <form onSubmit={create} className="mb-8 grid gap-2 rounded-site border border-gris bg-white p-4">
          <label htmlFor="tracker-name" className="font-bold text-violet">
            Nouveau tracker
          </label>
          <div className="flex gap-2 max-[520px]:flex-col">
            <input
              id="tracker-name"
              type="text"
              maxLength={120}
              placeholder="Ex. : affiches Berlin, tract marché de Vienne…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1"
            />
            <button type="submit" className="btn shrink-0" disabled={creating || !name.trim()}>
              {creating ? 'Création…' : '+ Créer'}
            </button>
          </div>
          {createError && (
            <div className="alert alert-err m-0" role="alert">
              {createError}
            </div>
          )}
        </form>

        {error ? (
          <div className="alert alert-err">Impossible de charger les trackers.</div>
        ) : trackers === null ? (
          <p className="loader">Chargement…</p>
        ) : !trackers.length ? (
          <p className="m-0 font-bold">Aucun tracker pour l'instant : créez-en un ci-dessus.</p>
        ) : (
          <>
            <h2 className="m-0 mb-1 text-[22px] text-violet">Trackers</h2>
            <p className="m-0 mb-3 text-[14px] text-texte">
              {trackers.length} tracker{trackers.length > 1 ? 's' : ''} · {total} visite{total > 1 ? 's' : ''} par leurs liens
            </p>
            <ul className="m-0 grid list-none gap-4 p-0">
              {trackers.map((t) => (
                <li key={t.id}>
                  <TrackerCard tracker={t} highlight={t.id === createdId} onChange={replace} onRemoved={() => removed(t.id)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

/** Une case de chiffre clé. */
function StatTile({ value, label, strong = false }: { value: number; label: string; strong?: boolean }) {
  const i18n = useI18n();
  return (
    <div className={`grid gap-1 rounded-lg px-4 py-3 ${strong ? 'bg-violet text-creme' : 'bg-lavande text-violet'}`}>
      <span className="text-[28px] leading-none font-extrabold tabular-nums">{i18n.number(value)}</span>
      <span className="text-[13px] font-bold">{label}</span>
    </div>
  );
}

/** Visites de tout le site : chiffres clés, langues, origine des visites sans tracker. */
function SiteVisits({ stats: s }: { stats: VisitStats }) {
  const i18n = useI18n();
  const sources = [{ source: 'Accès direct', count: s.direct, direct: true }, ...s.sources.map((x) => ({ ...x, direct: false }))]
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const others = s.untracked - sources.reduce((sum, x) => sum + x.count, 0);
  if (others > 0) sources.push({ source: 'Autres sites', count: others, direct: false });
  const max = Math.max(1, ...sources.map((x) => x.count));
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

  return (
    <section className="mb-8 grid gap-5 rounded-site border border-gris bg-white p-4" aria-labelledby="site-visits">
      <h2 id="site-visits" className="m-0 text-[22px] text-violet">
        Visites du site
      </h2>

      <div className="grid grid-cols-3 gap-2 max-[620px]:grid-cols-2">
        <StatTile value={s.total} label="visites au total" strong />
        <StatTile value={s.untracked} label="sans tracker" />
        <StatTile value={s.tracked} label="par un tracker" />
        <StatTile value={s.today} label="aujourd'hui" />
        <StatTile value={s.last_7_days} label="ces 7 derniers jours" />
        <StatTile value={s.last_30_days} label="ces 30 derniers jours" />
      </div>

      <div className="grid gap-2">
        <h3 className="m-0 text-[16px] text-violet">Par langue</h3>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <span key={l.code} className="inline-flex items-center gap-2 rounded-lg bg-lavande px-3 py-1.5 text-violet">
              <span className="text-[12px] font-bold">{l.label}</span>
              <span className="text-[18px] leading-none font-extrabold tabular-nums">{i18n.number(s.by_lang[l.code])}</span>
              <span className="text-[12px]">{pct(s.by_lang[l.code], s.total)} %</span>
            </span>
          ))}
        </div>
      </div>

      {sources.length > 0 && (
        <div className="grid gap-2">
          <h3 className="m-0 text-[16px] text-violet">D'où viennent les visites sans tracker</h3>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {sources.map((x) => (
              <li key={x.source} className="grid grid-cols-[minmax(110px,180px)_1fr_auto] items-center gap-3 text-[14px]">
                <span className={`truncate font-bold ${x.direct ? 'text-texte' : 'text-violet'}`} title={x.source}>
                  {x.source}
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-gris-clair" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${x.direct ? 'bg-texte/40' : 'bg-violet'}`}
                    style={{ width: `${(x.count / max) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">
                  <strong>{i18n.number(x.count)}</strong> <span className="text-texte">· {pct(x.count, s.untracked)} %</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TrackerCard({
  tracker: t,
  highlight,
  onChange,
  onRemoved,
}: {
  tracker: Tracker;
  highlight: boolean;
  onChange: (t: Tracker) => void;
  onRemoved: () => void;
}) {
  const i18n = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.name);
  /** Replié par défaut ; un tracker qui vient d'être créé s'ouvre pour copier ses liens. */
  const [open, setOpen] = useState(highlight);

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || draft.trim() === t.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      onChange(await api.renameTracker(t.id, draft.trim()));
      setEditing(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await api.deleteTracker(t.id);
      onRemoved();
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <article
      className={`overflow-hidden rounded-site border bg-white ${highlight ? 'border-violet shadow-site' : 'border-gris'}`}
    >
      <h2 className="m-0">
        <button
          type="button"
          className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-x-6 gap-y-3 border-0 bg-transparent p-4 text-left [font-family:inherit] hover:bg-gris-clair focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-jaune"
          aria-expanded={open}
          aria-controls={`tracker-details-${t.id}`}
          onClick={() => setOpen(!open)}
        >
          <span className="flex min-w-[200px] flex-1 items-center gap-3">
            <svg
              className={`h-4 w-4 shrink-0 fill-none stroke-violet stroke-[2.5] transition-transform duration-150 [stroke-linecap:round] [stroke-linejoin:round] ${open ? 'rotate-90' : ''}`}
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 3l5 5-5 5" />
            </svg>
            <span className="flex flex-wrap items-center gap-2 text-[19px] font-bold text-violet">
              {t.name}
              {highlight && <span className="badge bg-vert! text-white!">Nouveau</span>}
            </span>
          </span>

          <span className="flex items-center gap-2">
            <span className="grid min-w-[72px] place-items-center rounded-lg bg-violet px-3 py-1.5 text-creme">
              <span className="text-[24px] leading-none font-extrabold">{i18n.number(t.total)}</span>
              <span className="text-[12px]">visite{t.total > 1 ? 's' : ''}</span>
            </span>
          </span>
        </button>
      </h2>

      {open && (
        <div id={`tracker-details-${t.id}`} className="grid gap-4 border-t border-gris p-4">
          <QrLink id={`tracker-${t.id}`} name={t.name} urlFor={(lang) => trackerUrl(t.code, lang)} />

          <p className="m-0 text-[13px] text-texte">
            {LANGS.map((l) => `${l.short} ${i18n.number(t.counts[l.code])}`).join(' · ')} · créé le {i18n.date(t.created_at)}
            {t.last_visit
              ? ` · dernière visite le ${i18n.date(t.last_visit, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : " · aucune visite pour l'instant"}
          </p>

          <div className="flex flex-wrap items-center gap-3 border-t border-gris pt-3">
            {editing ? (
              <form onSubmit={rename} className="flex w-full flex-wrap gap-2">
                <label htmlFor={`tracker-rename-${t.id}`} className="visually-hidden">
                  Nom du tracker
                </label>
                <input
                  id={`tracker-rename-${t.id}`}
                  type="text"
                  maxLength={120}
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-w-0 flex-1 py-1.5! text-[15px]"
                />
                <button type="submit" className="btn btn-sm" disabled={busy}>
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setDraft(t.name);
                    setEditing(false);
                  }}
                >
                  Annuler
                </button>
              </form>
            ) : confirmDelete ? (
              <>
                <span className="text-[14px] font-bold text-rouge">
                  Supprimer ce tracker et ses {t.total} visite{t.total > 1 ? 's' : ''} ? Les liens ne compteront plus.
                </span>
                <button type="button" className="btn btn-rouge btn-sm" disabled={busy} onClick={remove}>
                  Oui
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>
                  Non
                </button>
              </>
            ) : t.can_edit ? (
              <>
                <button type="button" className="btn-link text-[14px] font-bold no-underline!" onClick={() => setEditing(true)}>
                  Renommer
                </button>
                <button
                  type="button"
                  className="btn-link text-[14px] font-bold text-rouge no-underline!"
                  onClick={() => setConfirmDelete(true)}
                >
                  Supprimer
                </button>
              </>
            ) : (
              <span className="text-[13px] text-texte">
                Créé par un autre compte : seul·e son auteur·ice ou un·e admin peut le modifier.
              </span>
            )}
          </div>

          {error && (
            <div className="alert alert-err m-0" role="alert">
              {error}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
