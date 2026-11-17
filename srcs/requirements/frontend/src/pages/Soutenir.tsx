import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link } from 'react-router';
import { FOOTER_ICONS } from '../components/footer-icons';
import { Photo } from '../components/Photo';
import { SupportMelenchon } from '../components/SupportMelenchon';
import { api } from '../lib/api';
import { COUNTRIES } from '../lib/campaign';
import { email, required, requiredTrue, useForm } from '../lib/forms';
import { useI18n } from '../lib/i18n';
import { networkColor } from '../lib/networks';
import type { SocialLink } from '../lib/models';
import { usePageTitle } from '../lib/title';

const HELPS = ['helpTracts', 'helpDoors', 'helpSocial', 'helpEvents', 'helpRegistration', 'helpVote'] as const;
type Help = (typeof HELPS)[number];

/** Page « Je soutiens » : suivre la campagne, soutenir Jean-Luc Mélenchon, s'engager. */
export default function Soutenir() {
  usePageTitle('support');
  const i18n = useI18n();
  const t = i18n.d.supportPage;

  const [socials, setSocials] = useState<SocialLink[]>([]);
  useEffect(() => {
    let alive = true;
    api.footerLinks().then((links) => alive && setSocials(links.socials));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      {/* 1. JE SOUTIENS LA CAMPAGNE : réseaux sociaux + événements */}
      <section className="page-hero overflow-hidden">
        <div className="site-container grid grid-cols-[1.2fr_1fr] items-center gap-12 max-[900px]:grid-cols-1">
          <div>
            <span className="eyebrow">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p className="lead">{t.lead}</p>

            {socials.length > 0 && (
              <>
                <h2 className="mt-8 mb-3 text-[22px]">{t.followTitle}</h2>
                <ul
                  className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0"
                  aria-label={t.networksAria}
                >
                  {socials.map((s) => {
                    const icon = FOOTER_ICONS[s.network] ?? FOOTER_ICONS['other'];
                    return (
                      <li key={s.id}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener me"
                          style={{ '--c': networkColor(s.network) } as CSSProperties}
                          className="flex items-center gap-3 rounded-site bg-(--c) px-4 py-3 font-bold text-white no-underline shadow-site transition-transform hover:-translate-y-0.5 hover:text-white hover:no-underline"
                        >
                          <svg
                            className="h-6 w-6 shrink-0 fill-current"
                            viewBox={icon.viewBox}
                            aria-hidden="true"
                            focusable="false"
                          >
                            <path d={icon.d} />
                          </svg>
                          {s.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <div className="btn-row mt-7">
              <Link to="/blog#agenda" className="btn">
                {t.seeEvents} →
              </Link>
            </div>
          </div>
          <Photo
            className="aspect-[4/5] -rotate-2 overflow-hidden rounded-site shadow-[14px_14px_0_var(--color-rouge)] max-[900px]:aspect-[4/3] max-[900px]:max-w-[560px] max-[900px]:rotate-0"
            name="equipeBerlin"
            sizes="(max-width: 900px) 100vw, 480px"
            caption={t.photoCaption}
          />
        </div>
      </section>

      {/* 2. JE SOUTIENS JEAN-LUC MÉLENCHON (même encart que l'accueil) */}
      <SupportMelenchon id="melenchon" />

      {/* 3. JE M'ENGAGE DANS LA CAMPAGNE */}
      <section className="section" id="engagement">
        <div className="site-container grid grid-cols-[1fr_1.3fr] items-start gap-12 max-[900px]:grid-cols-1">
          <div>
            <span className="eyebrow">{t.engageEyebrow}</span>
            <h2>{t.engageTitle}</h2>
            <p className="lead">{t.engageLead}</p>
            <ul className="m-0 mt-6 grid list-none gap-3 p-0">
              {t.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-3 font-bold">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-vert text-[15px] text-white"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <EngageForm />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Formulaire « Je m'engage ».
 * TODO : l'envoi n'est pas encore branché (à définir) ; pour l'instant seule la validation des champs fonctionne.
 */
function EngageForm() {
  const i18n = useI18n();
  const t = i18n.d.supportPage;
  const f = i18n.d.supporterForm;
  const countries = useMemo(
    () => COUNTRIES.map((c) => ({ code: c.code, name: i18n.country(c.code) })).sort((a, b) => i18n.compare(a.name, b.name)),
    [i18n],
  );
  const [helps, setHelps] = useState<Help[]>([]);
  const [error, setError] = useState('');

  const form = useForm(
    { first_name: '', last_name: '', email: '', phone: '', country: '', city: '', message: '', consent: false },
    { first_name: [required], last_name: [required], email: [required, email], country: [required], consent: [requiredTrue] },
  );

  const toggleHelp = (h: Help) => setHelps((list) => (list.includes(h) ? list.filter((x) => x !== h) : [...list, h]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.invalid) {
      form.touchAll();
      setError(form.isInvalid('consent') ? f.errConsent : f.errRequired);
      return;
    }
    // TODO : envoyer { ...form.values, helps } (logique à définir).
  };

  return (
    <form onSubmit={submit} noValidate className="form-grid">
      <div className="field">
        <label htmlFor="eg-first">{f.firstName}</label>
        <input id="eg-first" type="text" autoComplete="given-name" {...form.text('first_name')} />
      </div>
      <div className="field">
        <label htmlFor="eg-last">{f.lastName}</label>
        <input id="eg-last" type="text" autoComplete="family-name" {...form.text('last_name')} />
      </div>
      <div className="field">
        <label htmlFor="eg-email">{f.email}</label>
        <input id="eg-email" type="email" autoComplete="email" {...form.text('email')} />
        {form.touched.email && form.isInvalid('email') && <span className="error">{f.invalidEmail}</span>}
      </div>
      <div className="field">
        <label htmlFor="eg-phone">{f.phone}</label>
        <input id="eg-phone" type="tel" autoComplete="tel" {...form.text('phone')} />
      </div>
      <div className="field">
        <label htmlFor="eg-country">{f.country}</label>
        <select id="eg-country" {...form.text('country')}>
          <option value="" disabled>
            {f.choose}
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
          <option value="XX">{i18n.d.common.otherCountry}</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="eg-city">{f.city}</label>
        <input id="eg-city" type="text" autoComplete="address-level2" {...form.text('city')} />
      </div>

      <fieldset className="col-span-full m-0 grid grid-cols-2 gap-2.5 border-0 p-0 max-[600px]:grid-cols-1">
        <legend className="mb-2.5 p-0 text-[15px] font-bold">{t.howTitle}</legend>
        {HELPS.map((h) => (
          <label key={h} className="check">
            <input type="checkbox" checked={helps.includes(h)} onChange={() => toggleHelp(h)} />
            <span>{t[h]}</span>
          </label>
        ))}
      </fieldset>

      <div className="field col-span-full">
        <label htmlFor="eg-message">{t.message}</label>
        <textarea id="eg-message" rows={3} {...form.text('message')} />
      </div>

      <div className="col-span-full">
        <label className="check">
          <input type="checkbox" {...form.check('consent')} />
          <span>
            {f.consent} (<Link to="/mentions-legales">{f.consentMore}</Link>). *
          </span>
        </label>
      </div>
      {error && (
        <div className="col-span-full alert alert-err" role="alert">
          {error}
        </div>
      )}
      <div className="col-span-full">
        <button className="btn btn-rouge" type="submit">
          {t.submit}
        </button>
      </div>
    </form>
  );
}
