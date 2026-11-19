import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApprovalPanel } from '../components/ApprovalPanel';
import { fallback } from '../components/ArticleCard';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import type { Article, ArticleStatus } from '../lib/models';
import { notifyPendingChanged } from '../lib/pending';
import { usePageTitle } from '../lib/title';

/** Filtres d'état (paramètre d'adresse ?statut=…). */
const FILTERS: { key: string; label: string; status?: ArticleStatus }[] = [
  { key: '', label: 'Tous les articles' },
  { key: 'a-valider', label: 'À valider', status: 'pending' },
  { key: 'brouillons', label: 'Brouillons', status: 'draft' },
  { key: 'publies', label: 'Publiés', status: 'published' },
];

const STATUS_BADGE: Record<ArticleStatus, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'badge badge-draft' },
  pending: { label: 'À valider', className: 'badge badge-pending' },
  published: { label: 'Publié', className: 'badge bg-vert! text-white!' },
};

const CHIP = 'cursor-pointer rounded-full border-2 px-3.5 py-1.5 [font-family:inherit] text-[14px] font-bold';
const chip = (on: boolean) =>
  `${CHIP} ${on ? 'border-violet bg-violet text-creme' : 'border-violet bg-white text-violet hover:bg-lavande'}`;

/**
 * Espace rédaction (réservé aux comptes connectés qui peuvent écrire) : tous les articles visibles par le compte,
 * filtrables par état et par auteur·ice, pour les relire, valider, modifier ou supprimer.
 */
export default function Redaction() {
  usePageTitle('Articles — espace rédaction');
  const [params, setParams] = useSearchParams();
  const filterKey = params.get('statut') ?? '';
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const auth = useAuth();
  const mine = auth.canWrite && params.get('moi') === '1';

  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    api.allArticles(undefined, ctrl.signal).then(setArticles, (err) => {
      if ((err as Error)?.name !== 'AbortError') setError(true);
    });
    return () => ctrl.abort();
  }, []);

  const setParam = (name: string, value: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );

  /** Nombre d'articles par état (en tenant compte du filtre « Écrits par moi »). */
  const counts = useMemo(() => {
    const base = (articles ?? []).filter((a) => !mine || a.is_author);
    return Object.fromEntries(FILTERS.map((f) => [f.key, base.filter((a) => !f.status || a.status === f.status).length]));
  }, [articles, mine]);

  const shown = (articles ?? []).filter((a) => (!filter.status || a.status === filter.status) && (!mine || a.is_author));

  const replace = (updated: Article, how: 'approved' | 'published' = 'approved') => {
    setArticles((list) => list?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
    if (updated.status === 'published')
      setNotice(
        how === 'published'
          ? `🎉 « ${updated.title} » est publié.`
          : `🎉 « ${updated.title} » a reçu ses validations : il est publié.`,
      );
    notifyPendingChanged();
  };
  const removed = (id: number) => {
    setArticles((list) => list?.filter((a) => a.id !== id) ?? null);
    notifyPendingChanged();
  };

  return (
    <section className="section-sm">
      <div className="site-container">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Espace rédaction</span>
            <h1 className="h2 m-0">Articles</h1>
          </div>
          {auth.canWrite && (
            <Link to="/blog/ecrire" className="btn btn-rouge">
              + Écrire un article
            </Link>
          )}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par état">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={chip(filter.key === f.key)}
              aria-pressed={filter.key === f.key}
              onClick={() => setParam('statut', f.key)}
            >
              {f.label}
              {articles && <span className="ml-1.5 opacity-70">{counts[f.key]}</span>}
            </button>
          ))}
          {/* Relecteur·ices : pas d'articles à elles et eux, donc pas de filtre « Écrits par moi » */}
          {auth.canWrite && (
            <>
              <span className="mx-1 h-6 w-px bg-gris" aria-hidden="true" />
              <button type="button" className={chip(mine)} aria-pressed={mine} onClick={() => setParam('moi', mine ? '' : '1')}>
                ✍️ Écrits par moi
              </button>
            </>
          )}
        </div>
        {filter.status === 'pending' && (
          <p className="muted mt-0 mb-6 text-[15px]">
            Un article est publié dès qu'il a été validé par 2 comptes différents de celui de son auteur·ice. Lisez-le avant de le
            valider.
          </p>
        )}

        {notice && (
          <div className="alert alert-ok mb-6" role="status">
            {notice}
          </div>
        )}

        {error ? (
          <div className="alert alert-err">Impossible de charger les articles.</div>
        ) : articles === null ? (
          <p className="loader">Chargement…</p>
        ) : !shown.length ? (
          <div className="card mt-6 text-center">
            <p className="m-0 font-bold">Aucun article ici.</p>
          </div>
        ) : (
          <ul className="m-0 mt-6 grid list-none grid-cols-4 gap-5 p-0 max-[1180px]:grid-cols-3 max-[860px]:grid-cols-2 max-[560px]:grid-cols-1">
            {shown.map((a) => (
              <li key={a.id}>
                <ManageCard article={a} onChange={replace} onDeleted={() => removed(a.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Carte d'un article : image en fond avec l'état, résumé, validation et actions. */
function ManageCard({
  article: a,
  onChange,
  onDeleted,
}: {
  article: Article;
  onChange: (a: Article, how?: 'approved' | 'published') => void;
  onDeleted: () => void;
}) {
  const i18n = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  /** Publication directe (administrateur·ice principal·e), sans attendre les validations. */
  const publish = async () => {
    setError('');
    setPublishing(true);
    try {
      onChange(await api.publishArticle(a.slug), 'published');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  };
  const badge = STATUS_BADGE[a.status];

  const remove = async () => {
    setError('');
    try {
      await api.deleteArticle(a.slug);
      onDeleted();
    } catch (err) {
      setError(apiErrorMessage(err));
      setConfirming(false);
    }
  };

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-site bg-white shadow-site">
      <Link
        to={`/blog/${a.slug}`}
        className="relative block aspect-video overflow-hidden bg-lavande"
        tabIndex={-1}
        aria-hidden="true"
      >
        <img
          className="h-full w-full object-cover"
          src={a.cover_image || fallback(a.id)}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(33,35,32,.45)_0,rgba(33,35,32,0)_45%)]" />
        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className={badge.className}>{badge.label}</span>
          {a.category_detail && <span className="badge">{a.category_detail.name}</span>}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="m-0 text-[20px] leading-tight">
          <Link to={`/blog/${a.slug}`} className="text-violet no-underline hover:underline">
            {a.title}
          </Link>
        </h2>
        {a.excerpt && <p className="muted m-0 line-clamp-3 text-[14px]">{a.excerpt}</p>}
        <p className="m-0 mt-auto pt-1 text-[13px] text-texte">
          {a.is_author ? <strong>Vous</strong> : <strong>{a.author_name}</strong>} ·{' '}
          {a.status === 'published' && a.published_at
            ? `publié le ${i18n.date(a.published_at)}`
            : `modifié le ${i18n.date(a.updated_at)}`}
        </p>

        {a.status === 'pending' && (
          <div className="border-t border-gris pt-3 text-[14px]">
            <ApprovalPanel article={a} onApproved={onChange} />
          </div>
        )}

        {a.can_publish_now && (
          <div className="border-t border-gris pt-3">
            <button type="button" className="btn btn-rouge btn-sm w-full" disabled={publishing} onClick={publish}>
              {publishing ? 'Publication…' : '🚀 Publier maintenant'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-gris pt-3">
          {confirming ? (
            <>
              <span className="text-[14px] font-bold text-rouge">Supprimer ?</span>
              <button type="button" className="btn btn-rouge btn-sm" onClick={remove}>
                Oui
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(false)}>
                Non
              </button>
            </>
          ) : (
            <>
              <Link to={`/blog/${a.slug}`} className="btn btn-outline btn-sm">
                Voir
              </Link>
              {a.can_edit && (
                <Link to={`/blog/${a.slug}/modifier`} className="btn btn-sm">
                  Modifier
                </Link>
              )}
              {a.can_delete && (
                <button
                  type="button"
                  className="btn-link ml-auto text-[14px] font-bold text-rouge"
                  onClick={() => setConfirming(true)}
                >
                  Supprimer
                </button>
              )}
            </>
          )}
        </div>
        {error && (
          <div className="alert alert-err m-0" role="alert">
            {error}
          </div>
        )}
      </div>
    </article>
  );
}
