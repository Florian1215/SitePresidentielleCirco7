import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { Photo } from '../components/Photo';
import { api, apiErrorMessage } from '../lib/api';
import { CAMPAIGN, COUNTRIES } from '../lib/campaign';
import { email, minLength, required, useForm } from '../lib/forms';
import { useI18n } from '../lib/i18n';
import type { SocialLink } from '../lib/models';
import { usePageTitle } from '../lib/title';

export default function Contact() {
  usePageTitle('contact');
  const i18n = useI18n();
  const t = i18n.d.contact;
  const c = CAMPAIGN;
  /** Pays de la circonscription, nommés et triés dans la langue du site. */
  const countries = useMemo(
    () => COUNTRIES.map((p) => ({ code: p.code, name: i18n.country(p.code) })).sort((a, b) => i18n.compare(a.name, b.name)),
    [i18n],
  );
  const [socials, setSocials] = useState<SocialLink[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.footerLinks().then((l) => alive && setSocials(l.socials));
    return () => {
      alive = false;
    };
  }, []);

  const form = useForm(
    { name: '', email: '', country: '', subject: '', message: '' },
    { name: [required], email: [required, email], subject: [required], message: [required, minLength(10)] },
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.invalid) {
      form.touchAll();
      setError(t.errorRequired);
      return;
    }
    setSending(true);
    try {
      await api.contact(form.values);
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, i18n.d.errors));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p className="lead">{t.lead}</p>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-cols-[1.6fr_1fr] items-start gap-8 max-[900px]:grid-cols-1">
          <div className="card">
            {sent ? (
              <div className="alert alert-ok" role="status">
                {t.sent}
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="form-grid">
                <div className="field">
                  <label htmlFor="ct-name">{t.name}</label>
                  <input id="ct-name" type="text" autoComplete="name" {...form.text('name')} />
                </div>
                <div className="field">
                  <label htmlFor="ct-email">{t.email}</label>
                  <input id="ct-email" type="email" autoComplete="email" {...form.text('email')} />
                </div>
                <div className="field">
                  <label htmlFor="ct-country">{t.country}</label>
                  <select id="ct-country" {...form.text('country')}>
                    <option value="">—</option>
                    {countries.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                    <option value="XX">{i18n.d.common.otherCountry}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ct-subject">{t.subject}</label>
                  <input id="ct-subject" type="text" {...form.text('subject')} />
                </div>
                <div className="field full">
                  <label htmlFor="ct-message">{t.message}</label>
                  <textarea id="ct-message" rows={7} {...form.text('message')}></textarea>
                </div>
                <p className="full hint muted m-0 text-[13px]">
                  {t.privacy} <Link to="/mentions-legales">{t.more}</Link>.
                </p>
                {error && (
                  <div className="full alert alert-err" role="alert">
                    {error}
                  </div>
                )}
                <div className="full">
                  <button className="btn btn-rouge" type="submit" disabled={sending}>
                    {sending ? i18n.d.common.sending : i18n.d.common.send}
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="stack">
            <Photo
              className="aspect-[4/3] overflow-hidden rounded-site"
              name="equipeBerlin"
              sizes="(max-width: 900px) 100vw, 400px"
              position="55% 30%"
            />
            <div className="card-flat">
              <h3 className="text-[24px]">{t.byEmail}</h3>
              <p>
                <a href={'mailto:' + c.contactEmail}>{c.contactEmail}</a>
              </p>
            </div>
            {socials.length > 0 && (
              <div className="card-flat">
                <h3 className="text-[24px]">{t.follow}</h3>
                <div className="btn-row">
                  {socials.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener" className="btn btn-outline btn-sm">
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
