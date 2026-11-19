import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { Article, ReviewComment, ReviewCommentStatus } from '../lib/models';

const STATUS_BADGE: Record<ReviewCommentStatus, { label: string; className: string }> = {
  open: { label: 'À traiter', className: 'badge badge-pending' },
  done: { label: 'Pris en compte', className: 'badge bg-vert! text-white!' },
  declined: { label: 'Pas pris en compte', className: 'badge' },
};

/** Bouton de réponse de l'auteur·ice : plein quand c'est la réponse choisie. */
const answerBtn = (on: boolean, tone: 'vert' | 'gris') =>
  `cursor-pointer rounded-full border-2 px-3 py-1 [font-family:inherit] text-[13px] font-bold ${
    tone === 'vert'
      ? on
        ? 'border-vert bg-vert text-white'
        : 'border-vert bg-white text-vert hover:bg-vert/10'
      : on
        ? 'border-texte bg-texte text-white'
        : 'border-gris bg-white text-texte hover:bg-gris-clair'
  }`;

/**
 * Commentaires de relecture d'un article non publié : les comptes qui valident (relecteur·ices, rédacteur·ices,
 * admins) laissent des remarques ; les auteur·ices indiquent pour chacune si elle a été prise en compte ou non.
 */
export function ReviewComments({
  article: a,
  onCountsChange,
}: {
  article: Article;
  /** Met à jour le compteur affiché ailleurs sur la page. */
  onCountsChange: (total: number, open: number) => void;
}) {
  const i18n = useI18n();
  const [comments, setComments] = useState<ReviewComment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.articleComments(a.slug).then(setComments, () => setLoadError(true));
  }, [a.slug]);

  const update = (list: ReviewComment[]) => {
    setComments(list);
    onCountsChange(list.length, list.filter((c) => c.status === 'open').length);
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError('');
    try {
      const created = await api.addArticleComment(a.slug, text);
      update([...(comments ?? []), created]);
      setText('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="commentaires" className="mt-[clamp(40px,6vw,64px)] scroll-mt-24 border-t border-gris pt-[clamp(28px,4vw,40px)]">
      <h2 className="mb-1 text-[clamp(24px,3vw,32px)]">
        Commentaires de relecture{comments && comments.length > 0 && ` (${comments.length})`}
      </h2>
      <p className="muted mt-0 mb-5 text-[14px]">Visibles seulement par les auteur·ices de l'article et les relecteur·ices.</p>

      {loadError ? (
        <div className="alert alert-err">Impossible de charger les commentaires.</div>
      ) : comments === null ? (
        <p className="loader">Chargement…</p>
      ) : (
        <ul className="m-0 mb-6 grid list-none gap-3 p-0">
          {comments.length === 0 && <li className="muted text-[15px]">Aucun commentaire pour l'instant.</li>}
          {comments.map((c) => (
            <li key={c.id}>
              <CommentItem
                slug={a.slug}
                comment={c}
                date={i18n.date(c.created_at)}
                onChange={(updated) => update(comments.map((x) => (x.id === updated.id ? updated : x)))}
                onDeleted={() => update(comments.filter((x) => x.id !== c.id))}
              />
            </li>
          ))}
        </ul>
      )}

      {a.can_comment && (
        <form onSubmit={add} className="stack" noValidate>
          <div className="field">
            <label htmlFor="review-comment">Ajouter un commentaire</label>
            <textarea
              id="review-comment"
              rows={3}
              maxLength={3000}
              placeholder="Ex. : 2e paragraphe, « tout le monde sont » → « tout le monde est »."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          {error && (
            <div className="alert alert-err m-0" role="alert">
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-sm self-start" disabled={sending || !text.trim()}>
            {sending ? 'Envoi…' : 'Ajouter le commentaire'}
          </button>
        </form>
      )}
    </section>
  );
}

function CommentItem({
  slug,
  comment: c,
  date,
  onChange,
  onDeleted,
}: {
  slug: string;
  comment: ReviewComment;
  date: string;
  onChange: (c: ReviewComment) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const badge = STATUS_BADGE[c.status];

  const run = async (call: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await call();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** Recliquer sur la réponse choisie la retire (le commentaire redevient « à traiter »). */
  const answer = (status: ReviewCommentStatus) =>
    run(async () => onChange(await api.setArticleCommentStatus(slug, c.id, c.status === status ? 'open' : status)));

  return (
    <article className={`rounded-site border bg-white p-4 border-gris ${c.status === 'open' ? 'border-l-4 border-l-jaune' : ''}`}>
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="text-[15px] text-violet">{c.is_mine ? 'Vous' : c.author_name}</strong>
        <span className="text-[13px] text-texte">{date}</span>
        <span className={`${badge.className} ml-auto`}>{badge.label}</span>
      </header>
      <p className="m-0 text-[15px] whitespace-pre-line [overflow-wrap:anywhere]">{c.text}</p>

      {(c.can_set_status || c.can_delete) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {c.can_set_status && (
            <>
              <button
                type="button"
                className={answerBtn(c.status === 'done', 'vert')}
                aria-pressed={c.status === 'done'}
                disabled={busy}
                onClick={() => answer('done')}
              >
                ✓ Pris en compte
              </button>
              <button
                type="button"
                className={answerBtn(c.status === 'declined', 'gris')}
                aria-pressed={c.status === 'declined'}
                disabled={busy}
                onClick={() => answer('declined')}
              >
                ✗ Pas pris en compte
              </button>
            </>
          )}
          {c.can_delete && (
            <button
              type="button"
              className="btn-link ml-auto text-[13px] font-bold text-rouge"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api.deleteArticleComment(slug, c.id);
                  onDeleted();
                })
              }
            >
              Supprimer
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="alert alert-err m-0 mt-3" role="alert">
          {error}
        </div>
      )}
    </article>
  );
}
