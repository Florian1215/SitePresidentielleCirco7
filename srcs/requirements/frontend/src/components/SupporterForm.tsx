import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { api, apiErrorMessage } from '../lib/api';
import { COUNTRIES } from '../lib/campaign';
import { email, required, requiredTrue, useForm } from '../lib/forms';
import { useI18n } from '../lib/i18n';

interface Props {
  helpPreset?: boolean;
  submitLabel?: string;
}

export function SupporterForm({ helpPreset = false, submitLabel = 'Je soutiens' }: Props) {
  const i18n = useI18n();
  const t = i18n.d.supporterForm;
  /** Pays de la circonscription, nommés et triés dans la langue du site. */
  const countries = useMemo(
    () => COUNTRIES.map((c) => ({ code: c.code, name: i18n.country(c.code) })).sort((a, b) => i18n.compare(a.name, b.name)),
    [i18n],
  );
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const form = useForm(
    {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      country: '',
      city: '',
      wants_registration_help: helpPreset,
      wants_reminders: true,
      wants_to_volunteer: false,
      consent: false,
    },
    {
      first_name: [required],
      last_name: [required],
      email: [required, email],
      country: [required],
      consent: [requiredTrue],
    },
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.invalid) {
      form.touchAll();
      setError(form.isInvalid('consent') ? t.errConsent : t.errRequired);
      return;
    }
    setSending(true);
    try {
      await api.supporter(form.values);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, i18n.d.errors));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="alert alert-ok" role="status">
        <strong>{t.thanks}</strong> {t.saved} {form.values.wants_registration_help ? t.willHelp : t.willRemind}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="form-grid">
      <div className="field">
        <label htmlFor="sf-first">{t.firstName}</label>
        <input id="sf-first" type="text" autoComplete="given-name" {...form.text('first_name')} />
      </div>
      <div className="field">
        <label htmlFor="sf-last">{t.lastName}</label>
        <input id="sf-last" type="text" autoComplete="family-name" {...form.text('last_name')} />
      </div>
      <div className="field">
        <label htmlFor="sf-email">{t.email}</label>
        <input id="sf-email" type="email" autoComplete="email" {...form.text('email')} />
        {form.touched.email && form.isInvalid('email') && <span className="error">{t.invalidEmail}</span>}
      </div>
      <div className="field">
        <label htmlFor="sf-phone">{t.phone}</label>
        <input id="sf-phone" type="tel" autoComplete="tel" {...form.text('phone')} />
      </div>
      <div className="field">
        <label htmlFor="sf-country">{t.country}</label>
        <select id="sf-country" {...form.text('country')}>
          <option value="" disabled>
            {t.choose}
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
        <label htmlFor="sf-city">{t.city}</label>
        <input id="sf-city" type="text" autoComplete="address-level2" {...form.text('city')} />
      </div>
      <div className="col-span-full stack">
        <label className="check">
          <input type="checkbox" {...form.check('wants_registration_help')} />
          <span>{t.wantsHelp}</span>
        </label>
        <label className="check">
          <input type="checkbox" {...form.check('wants_reminders')} />
          <span>{t.wantsReminders}</span>
        </label>
        <label className="check">
          <input type="checkbox" {...form.check('wants_to_volunteer')} />
          <span>{t.wantsVolunteer}</span>
        </label>
        <label className="check">
          <input type="checkbox" {...form.check('consent')} />
          <span>
            {t.consent} (<Link to="/mentions-legales">{t.consentMore}</Link>). *
          </span>
        </label>
      </div>
      {error && (
        <div className="col-span-full alert alert-err" role="alert">
          {error}
        </div>
      )}
      <div className="col-span-full">
        <button className="btn btn-rouge" type="submit" disabled={sending}>
          {sending ? i18n.d.common.sending : submitLabel}
        </button>
      </div>
    </form>
  );
}
