import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { apiErrorMessage } from '../lib/api';
import { hasPerm, login, logout, register, useAuth } from '../lib/auth';
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
      <div className="site-container max-w-[820px] prose">
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
      <div className="site-container max-w-[820px]">
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

type Mode = 'login' | 'register';

const TAB = (on: boolean) =>
  `flex-1 cursor-pointer rounded-full border-0 px-4 py-2 [font-family:inherit] text-[15px] font-bold transition-colors ${
    on ? 'bg-violet text-creme' : 'bg-transparent text-violet hover:bg-violet/10'
  }`;

/**
 * Se connecter (prénom, nom, mot de passe) ou demander un compte.
 * Un compte créé ici reste en attente : un·e admin le valide dans /admin (action « Valider »),
 * ce qui donne le seul droit possible, celui d'écrire des articles.
 * Seul accès : le lien « Se connecter » du pied de page.
 */
export function Login() {
  usePageTitle('Connexion');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setPassword('');
    setPassword2('');
  };

  const mismatch = mode === 'register' && password2 !== '' && password !== password2;
  const ready = !!firstName.trim() && !!lastName.trim() && !!password && (mode === 'login' || password === password2);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSending(true);
    setError('');
    const credentials = { first_name: firstName.trim(), last_name: lastName.trim(), password };
    try {
      if (mode === 'register') {
        await register(credentials);
        setSending(false);
        setRequested(true);
        setPassword('');
        setPassword2('');
        return;
      }
      const user = await login(credentials);
      setSending(false);
      const next = params.get('next');
      const target =
        next && next.startsWith('/') && !next.startsWith('//') ? next : hasPerm(user, 'blog.add_article') ? '/blog' : '/';
      navigate(target);
    } catch (err) {
      setSending(false);
      setError(apiErrorMessage(err));
    }
  };

  if (auth.user) {
    const name = [auth.user.first_name, auth.user.last_name].filter(Boolean).join(' ') || auth.user.username;
    return (
      <section className="section">
        <div className="site-container max-w-[480px]">
          <div className="card stack">
            <h1 className="h2 m-0">Connexion</h1>
            <p className="m-0">
              Vous êtes connecté·e en tant que <strong>{name}</strong>.
            </p>
            {!auth.canWrite && (
              <div className="alert alert-info">Votre compte n'a pas encore le droit d'écrire des articles.</div>
            )}
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (requested) {
    return (
      <section className="section">
        <div className="site-container max-w-[480px]">
          <div className="card stack">
            <span className="text-[40px] leading-none" aria-hidden="true">
              ⏳
            </span>
            <h1 className="h2 m-0">Demande envoyée</h1>
            <p className="m-0">
              Merci <strong>{firstName.trim()}</strong> ! Votre compte est <strong>en attente de validation</strong>. Dès qu'un·e
              administrateur·ice l'aura validé, vous pourrez vous connecter avec vos prénom, nom et mot de passe pour écrire des
              articles.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setRequested(false);
                switchMode('login');
              }}
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </section>
    );
  }

  const isLogin = mode === 'login';
  return (
    <section className="section">
      <div className="site-container max-w-[480px]">
        <div className="card stack">
          <div
            className="flex gap-1 rounded-full border-2 border-violet p-1"
            role="tablist"
            aria-label="Connexion ou création de compte"
          >
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                id={`tab-${m}`}
                aria-selected={mode === m}
                aria-controls="auth-form"
                className={TAB(mode === m)}
                onClick={() => switchMode(m)}
              >
                {m === 'login' ? 'Se connecter' : 'Créer un compte'}
              </button>
            ))}
          </div>

          <h1 className="h2 m-0 mt-2">{isLogin ? 'Connexion' : 'Créer un compte'}</h1>

          <form id="auth-form" role="tabpanel" aria-labelledby={`tab-${mode}`} onSubmit={submit} className="stack" noValidate>
            <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
              <div className="field">
                <label htmlFor="lg-first">Prénom</label>
                <input
                  id="lg-first"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="lg-last">Nom</label>
                <input
                  id="lg-last"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="lg-pass">Mot de passe</label>
              <input
                id="lg-pass"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {!isLogin && <span className="hint">Au moins 8 caractères, pas uniquement des chiffres.</span>}
            </div>
            {!isLogin && (
              <div className="field">
                <label htmlFor="lg-pass2">Confirmer le mot de passe</label>
                <input
                  id="lg-pass2"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  aria-invalid={mismatch}
                  aria-describedby={mismatch ? 'lg-pass2-err' : undefined}
                  onChange={(e) => setPassword2(e.target.value)}
                />
                {mismatch && (
                  <span id="lg-pass2-err" className="error">
                    Les deux mots de passe ne correspondent pas.
                  </span>
                )}
              </div>
            )}
            {error && (
              <div className="alert alert-err" role="alert">
                {error}
              </div>
            )}
            <button className={isLogin ? 'btn' : 'btn btn-rouge'} type="submit" disabled={sending || !ready}>
              {sending ? 'Envoi…' : isLogin ? 'Se connecter' : 'Demander un compte'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
