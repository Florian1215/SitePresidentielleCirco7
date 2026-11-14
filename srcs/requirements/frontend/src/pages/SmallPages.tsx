import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { apiErrorMessage } from '../lib/api';
import { hasPerm, login, useAuth } from '../lib/auth';
import { CAMPAIGN } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import { usePageTitle } from '../lib/title';

/** Mentions légales. */
export function Legal() {
  usePageTitle('legal');
  const i18n = useI18n();
  const t = i18n.d.legal;
  return (
    <section className="section">
      <div className="container container-narrow prose">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1 className="h2">{t.title}</h1>

        <h2>{t.publisherTitle}</h2>
        <p>
          {i18n.f(t.publisher, { circo: i18n.d.common.circo })} <em>{t.publisherTodo}</em>
        </p>

        <h2>{t.dataTitle}</h2>
        <p>{t.data1}</p>
        <p>{t.data2}</p>
        <p>
          {t.data3} <a href={'mailto:' + CAMPAIGN.contactEmail}>{CAMPAIGN.contactEmail}</a>. {t.data3b}
        </p>

        <h2>{t.cookiesTitle}</h2>
        <p>{t.cookies}</p>
      </div>
    </section>
  );
}

/** Page introuvable. */
export function NotFound() {
  usePageTitle('notFound');
  const { d } = useI18n();
  return (
    <section className="section">
      <div className="container container-narrow">
        <span className="sticker">{d.notFound.badge}</span>
        <h1>{d.notFound.title}</h1>
        <p className="lead">{d.notFound.lead}</p>
        <Link to="/" className="btn">
          {d.notFound.back}
        </Link>
      </div>
    </section>
  );
}

/** Connexion à l'espace rédaction. */
export function Login() {
  usePageTitle('Connexion');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const user = await login(username, password);
      setSending(false);
      const next = params.get('next');
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : hasPerm(user, 'blog.add_article') ? '/blog' : '/';
      navigate(target);
    } catch (err) {
      setSending(false);
      setError(apiErrorMessage(err));
    }
  };

  return (
    <section className="section">
      <div className="container max-w-[480px]">
        <div className="card">
          <span className="eyebrow">Espace rédaction</span>
          <h1 className="h2">Connexion</h1>
          {auth.user ? (
            <>
              <p>
                Vous êtes connecté·e en tant que <strong>{auth.user.username}</strong>.
              </p>
              {!auth.canWrite && (
                <div className="alert alert-info">
                  Votre compte n'a pas encore le droit d'écrire des articles. Demandez à un·e administrateur·ice de vous ajouter au
                  groupe « Rédacteur·ices ».
                </div>
              )}
            </>
          ) : (
            <form onSubmit={submit} className="stack" noValidate>
              <div className="field">
                <label htmlFor="lg-user">Identifiant</label>
                <input id="lg-user" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="lg-pass">Mot de passe</label>
                <input
                  id="lg-pass"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <div className="alert alert-err" role="alert">
                  {error}
                </div>
              )}
              <button className="btn" type="submit" disabled={sending || !username || !password}>
                {sending ? 'Connexion…' : 'Se connecter'}
              </button>
              <p className="muted m-0 text-[14px]">
                Les comptes sont créés par les administrateur·ices du site. Pas encore de compte ? Contactez l'équipe de campagne.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
