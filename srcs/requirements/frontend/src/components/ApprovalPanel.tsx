import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import type { Article } from '../lib/models';

/**
 * Validation d'un article « À valider » : progression (✓ par validation), noms des valideur·ses
 * et bouton « Valider » pour les comptes qui le peuvent. Publication automatique à la dernière validation.
 */
export function ApprovalPanel({ article: a, onApproved }: { article: Article; onApproved: (updated: Article) => void }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const done = a.approvals.length;
  const total = a.approvals_required;

  const approve = async () => {
    setSending(true);
    setError('');
    try {
      onApproved(await api.approveArticle(a.slug));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const reason = a.is_author
    ? "C'est votre article : il doit être validé par d'autres comptes."
    : !a.can_approve && done > 0
      ? 'Vous avez déjà validé cet article.'
      : '';

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[14px] font-black ${
                i < done ? 'border-vert bg-vert text-white' : 'border-dashed border-gris text-texte'
              }`}
            >
              {i < done ? '✓' : i + 1}
            </span>
          ))}
        </span>
        <span className="text-[15px] font-bold">
          {done} / {total} validations
          {done > 0 && <span className="font-normal text-texte"> · {a.approvals.join(', ')}</span>}
        </span>
      </div>
      {a.can_approve ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-sm" disabled={sending} onClick={approve}>
            {sending ? 'Envoi…' : '✓ Valider'}
          </button>
          {done + 1 >= total && <span className="text-[14px] text-texte">Votre validation publiera l'article.</span>}
        </div>
      ) : (
        reason && <p className="m-0 text-[14px] text-texte">{reason}</p>
      )}
      {error && (
        <div className="alert alert-err m-0" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
