import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, apiErrorMessage } from '../lib/api';
import { hasPerm, login, logout, register, useAuth } from '../lib/auth';
import { CAMPAIGN } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import type { ActionGroup } from '../lib/models';
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
          {i18n.f(t.publisher, { circo: i18n.d.common.circo })}
          <br />
          <strong>{t.directorLabel}</strong> {t.director}
          <br />
          <strong>{t.hostLabel}</strong> {t.host}
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
 * Se connecter (email, mot de passe) ou demander un compte (prénom, nom, email, groupe d'action, mot de passe).
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);
  /** La personne a tenté de demander un compte : on signale alors un mot de passe trop faible. */
  const [triedRegister, setTriedRegister] = useState(false);
  /** Groupe d'action choisi à l'inscription (obligatoire) : son id, ou '' tant qu'aucun n'est choisi. */
  const [group, setGroup] = useState('');
  const [groups, setGroups] = useState<ActionGroup[] | null>(null);
  const i18n = useI18n();

  // Liste des groupes d'action, chargée à la première ouverture de l'onglet « Créer un compte »
  useEffect(() => {
    if (mode !== 'register' || groups) return;
    api.actionGroups().then(setGroups, () => setGroups([]));
  }, [mode, groups]);

  /** Groupes d'action rangés par pays (dans l'ordre alphabétique des pays, puis des groupes). */
  const groupsByCountry = useMemo(() => {
    const byCountry = new Map<string, ActionGroup[]>();
    for (const g of groups ?? []) byCountry.set(g.country, [...(byCountry.get(g.country) ?? []), g]);
    return [...byCountry]
      .map(([code, list]) => ({
        country: i18n.country(code),
        list: list.sort((a, b) => i18n.compare(a.name, b.name)),
      }))
      .sort((a, b) => i18n.compare(a.country, b.country));
  }, [groups, i18n]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setTriedRegister(false);
    setPassword('');
    setPassword2('');
  };

  const mismatch = mode === 'register' && password2 !== '' && password !== password2;
  /** Mêmes règles que le serveur : au moins 8 caractères, pas uniquement des chiffres. */
  const weakPassword = password.length < 8 || /^\d+$/.test(password);
  const showWeak = mode === 'register' && triedRegister && weakPassword;
  /** Vérification simple ; le serveur valide l'adresse pour de bon. */
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready =
    !!email.trim() &&
    !!password &&
    (mode === 'login' || (!!firstName.trim() && !!lastName.trim() && emailOk && password === password2 && !!group));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    if (mode === 'register') {
      setTriedRegister(true);
      if (weakPassword) return;
    }
    setSending(true);
    setError('');
    const credentials = { email: email.trim(), password };
    try {
      if (mode === 'register') {
        await register({
          ...credentials,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          action_group: Number(group),
        });
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
        next && next.startsWith('/') && !next.startsWith('//')
          ? next
          : hasPerm(user, 'blog.add_article')
            ? '/blog'
            : hasPerm(user, 'blog.review_article')
              ? '/redaction/articles?statut=a-valider'
              : '/';
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
            {!auth.canWrite && !auth.canReview && (
              <div className="alert alert-info">Votre compte n'a pas encore de droits sur les articles.</div>
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
            <h1 className="h2 m-0 flex items-center gap-3 text-[clamp(24px,6vw,32px)] whitespace-nowrap">
              <span className="text-[0.9em] leading-none" aria-hidden="true">
                ⏳
              </span>
              Demande envoyée
            </h1>
            <p className="m-0">
              Merci <strong>{firstName.trim()}</strong> ! Votre compte est <strong>en attente de validation</strong> par les
              gestionnaires de votre groupe d'action. Vous recevrez un email à <strong>{email.trim()}</strong> dès qu'il sera
              validé : vous pourrez alors vous connecter avec votre email et votre mot de passe.
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
            {!isLogin && (
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
            )}
            <div className="field">
              <label htmlFor="lg-email">Email</label>
              <input
                id="lg-email"
                type="email"
                autoComplete={isLogin ? 'username' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!isLogin && (
              <div className="field">
                <label htmlFor="lg-group">Groupe d'action</label>
                <select id="lg-group" value={group} onChange={(e) => setGroup(e.target.value)} disabled={groups === null}>
                  <option value="" disabled>
                    {groups === null ? 'Chargement…' : 'Choisir votre groupe d’action'}
                  </option>
                  {groupsByCountry.map(({ country, list }) => (
                    <optgroup key={country} label={country}>
                      {list.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                          {g.city && !g.name.includes(g.city) ? ` (${g.city})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="lg-pass">Mot de passe</label>
              <input
                id="lg-pass"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                aria-invalid={showWeak}
                aria-describedby={showWeak ? 'lg-pass-err' : undefined}
                onChange={(e) => setPassword(e.target.value)}
              />
              {showWeak && (
                <span id="lg-pass-err" className="error">
                  Le mot de passe doit faire au moins 8 caractères et ne pas contenir que des chiffres.
                </span>
              )}
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

/**
 * « Mot de passe oublié » : page ouverte depuis le lien créé par un·e admin (page Membres).
 * Le lien identifie le compte ; la personne choisit simplement un nouveau mot de passe.
 */
export function ResetPassword() {
  usePageTitle('Mot de passe oublié');
  const { uid = '', token = '' } = useParams();
  /** undefined : vérification du lien en cours ; null : lien invalide. */
  const [firstName, setFirstName] = useState<string | null | undefined>(undefined);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.checkResetLink(uid, token).then(
      (res) => setFirstName(res.first_name),
      (err) => {
        setFirstName(null);
        setLinkError(apiErrorMessage(err));
      },
    );
  }, [uid, token]);

  /** Mêmes règles que le serveur : au moins 8 caractères, pas uniquement des chiffres. */
  const weak = password.length < 8 || /^\d+$/.test(password);
  const mismatch = password2 !== '' && password !== password2;
  const showWeak = tried && weak;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (weak || !password2 || password !== password2) return;
    setSending(true);
    setError('');
    try {
      await api.resetPassword(uid, token, password);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="section">
      <div className="site-container max-w-[480px]">
        <div className="card stack">
          <h1 className="h2 m-0">Mot de passe oublié</h1>
          {firstName === undefined ? (
            <p className="loader">Vérification du lien…</p>
          ) : firstName === null ? (
            <div className="alert alert-err m-0" role="alert">
              {linkError}
            </div>
          ) : done ? (
            <>
              <div className="alert alert-ok m-0" role="status">
                Votre nouveau mot de passe est enregistré.
              </div>
              <Link to="/connexion" className="btn self-start">
                Se connecter
              </Link>
            </>
          ) : (
            <form onSubmit={submit} className="stack" noValidate>
              {firstName && (
                <p className="m-0">
                  Bonjour <strong>{firstName}</strong>, choisissez votre nouveau mot de passe.
                </p>
              )}
              <div className="field">
                <label htmlFor="rs-pass">Tapez votre nouveau mot de passe</label>
                <input
                  id="rs-pass"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  aria-invalid={showWeak}
                  aria-describedby={showWeak ? 'rs-pass-err' : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {showWeak && (
                  <span id="rs-pass-err" className="error">
                    Le mot de passe doit faire au moins 8 caractères et ne pas contenir que des chiffres.
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="rs-pass2">Confirmez votre nouveau mot de passe</label>
                <input
                  id="rs-pass2"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  aria-invalid={mismatch || (tried && !password2)}
                  aria-describedby={mismatch ? 'rs-pass2-err' : undefined}
                  onChange={(e) => setPassword2(e.target.value)}
                />
                {(mismatch || (tried && !password2)) && (
                  <span id="rs-pass2-err" className="error">
                    {mismatch ? 'Les deux mots de passe ne correspondent pas.' : 'Confirmez votre mot de passe.'}
                  </span>
                )}
              </div>
              {error && (
                <div className="alert alert-err m-0" role="alert">
                  {error}
                </div>
              )}
              <button type="submit" className="btn" disabled={sending}>
                {sending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
