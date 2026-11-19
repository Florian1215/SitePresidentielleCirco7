import { useState } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import type { Article } from '../lib/models';

/**
 * Validation d'un article « À valider » : progression (✓ par validation), noms des valideur·ses
 * et bouton « Valider » pour les comptes qui le peuvent. Publication automatique à la dernière validation.
 */
export function ApprovalPanel({
  article: a,
  onApproved,
  variant = 'row',
}: {
  article: Article;
  onApproved: (updated: Article) => void;
  /** row : ligne compacte (cartes de l'espace rédaction) ; squares : un petit carré par validation (page de l'article). */
  variant?: 'row' | 'squares';
}) {
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

  if (variant === 'squares') {
    return (
      <div className="grid gap-2">
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0" aria-label={`Validations : ${done} sur ${total}`}>
          {Array.from({ length: total }, (_, i) => {
            const by = a.approvals[i];
            // La case suivante à remplir porte le bouton, si le compte peut valider
            const next = i === done && a.can_approve;
            return (
              <li
                key={i}
                className={`grid h-[124px] w-[124px] place-content-center justify-items-center gap-1.5 rounded-site border-2 p-2 text-center ${
                  by
                    ? 'border-vert bg-vert text-white'
                    : next
                      ? 'border-violet bg-white'
                      : 'border-dashed border-gris bg-white text-texte'
                }`}
              >
                {by ? (
                  <>
                    <span className="text-[30px] leading-none font-black" aria-hidden="true">
                      ✓
                    </span>
                    <span className="text-[12px] font-bold">Validé par</span>
                    <span className="line-clamp-2 text-[13px] leading-tight [overflow-wrap:anywhere]">{by}</span>
                  </>
                ) : next ? (
                  <>
                    <span className="text-[12px] font-bold text-violet">Validation {i + 1}</span>
                    <button type="button" className="btn btn-sm" disabled={sending} onClick={approve}>
                      {sending ? '…' : '✓ Valider'}
                    </button>
                    {done + 1 >= total && <span className="text-[11px] leading-tight">publiera l'article</span>}
                  </>
                ) : (
                  <>
                    <span className="font-titre text-[30px] leading-none" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="text-[12px] font-bold">En attente</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {error && (
          <div className="alert alert-err m-0" role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }

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
      {a.can_approve && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-sm" disabled={sending} onClick={approve}>
            {sending ? 'Envoi…' : '✓ Valider'}
          </button>
          {done + 1 >= total && <span className="text-[14px] text-texte">Votre validation publiera l'article.</span>}
        </div>
      )}
      {error && (
        <div className="alert alert-err m-0" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
