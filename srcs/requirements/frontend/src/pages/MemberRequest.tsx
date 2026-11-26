import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api, apiErrorMessage } from '../lib/api';
import type { MemberRequest as Request } from '../lib/api';
import { usePageTitle } from '../lib/title';

/**
 * Page ouverte depuis les boutons Accepter / Refuser de l'email « Nouvelle demande d'inscription ».
 * Le lien signé suffit (pas de connexion) ; un clic de confirmation évite que les antivirus des messageries,
 * qui ouvrent les liens des emails, acceptent ou refusent la demande à la place de la personne.
 */
export default function MemberRequest() {
  usePageTitle("Demande d'inscription");
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const wanted = params.get('action') === 'refuser' ? 'refuse' : 'accept';
  /** undefined : chargement ; null : lien invalide */
  const [req, setReq] = useState<Request | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [sending, setSending] = useState<'accept' | 'refuse' | null>(null);

  useEffect(() => {
    api.memberRequest(token).then(setReq, (err) => {
      setReq(null);
      setError(apiErrorMessage(err));
    });
  }, [token]);

  const decide = async (action: 'accept' | 'refuse') => {
    setSending(action);
    setError('');
    try {
      const res = await api.decideMemberRequest(token, action);
      setReq((r) => ({ ...r, ...res }));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    setSending(null);
  };

  const name = [req?.first_name, req?.last_name].filter(Boolean).join(' ');
  const done =
    req?.status === 'active'
      ? { icon: '✓', label: 'Acceptée', color: 'text-vert' }
      : req?.status === 'refused' || req?.status === 'gone'
        ? { icon: '✕', label: 'Refusée', color: 'text-rouge' }
        : req?.status === 'revoked'
          ? { icon: '✕', label: 'Accès retiré', color: 'text-rouge' }
          : null;

  return (
    <section className="section">
      <div className="site-container max-w-[480px]">
        <div className="card stack">
          <h1 className="h2 m-0">Demande d'inscription</h1>

          {req === undefined && <p className="m-0 text-texte">Chargement…</p>}

          {req === null && (
            <div className="alert alert-err" role="alert">
              {error}
            </div>
          )}

          {req && name && (
            <div className="rounded-site border-2 border-lavande bg-white p-5">
              <p className="m-0 text-[22px] leading-tight font-bold text-noir">{name}</p>
              {req.email && (
                <a className="mt-1 block text-[15px] no-underline" href={`mailto:${req.email}`}>
                  {req.email}
                </a>
              )}
              {req.action_group && (
                <span className="mt-3 inline-block rounded-full bg-lavande px-3.5 py-1.5 text-[13px] font-bold tracking-[0.02em] text-violet uppercase">
                  {req.action_group}
                </span>
              )}
            </div>
          )}

          {req && done && (
            <p className={`m-0 flex items-center gap-3 font-titre text-[32px] uppercase ${done.color}`} role="status">
              <span aria-hidden="true">{done.icon}</span>
              {done.label}
            </p>
          )}

          {req?.status === 'pending' && (
            <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
              <button
                type="button"
                className="btn"
                autoFocus={wanted === 'accept'}
                disabled={sending !== null}
                onClick={() => decide('accept')}
              >
                {sending === 'accept' ? '…' : '✓ Accepter'}
              </button>
              <button
                type="button"
                className="btn btn-outline !border-rouge !text-rouge hover:!bg-rouge hover:!text-creme"
                autoFocus={wanted === 'refuse'}
                disabled={sending !== null}
                onClick={() => decide('refuse')}
              >
                {sending === 'refuse' ? '…' : '✕ Refuser'}
              </button>
            </div>
          )}

          {req && error && (
            <div className="alert alert-err" role="alert">
              {error}
            </div>
          )}

          {req && done && (
            <Link to="/redaction/membres" className="text-[14px]">
              Voir les membres
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
