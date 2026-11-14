import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

/** Validateurs (mêmes règles que les formulaires réactifs d'Angular d'origine). */
export const required = (v: unknown) => (typeof v === 'string' ? v.length > 0 : v !== null && v !== undefined);
export const requiredTrue = (v: unknown) => v === true;
export const maxLength = (n: number) => (v: unknown) => typeof v !== 'string' || v.length <= n;
export const minLength = (n: number) => (v: unknown) => typeof v !== 'string' || v.length === 0 || v.length >= n;
const EMAIL =
  /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export const email = (v: unknown) => typeof v !== 'string' || v === '' || EMAIL.test(v);

type Validator = (v: unknown) => boolean;

/**
 * Petit gestionnaire de formulaire : valeurs, champs « touchés » (quittés au moins une fois)
 * et validité. Un champ invalide et touché reçoit aria-invalid (bordure rouge, cf. global.scss).
 */
export function useForm<T extends Record<string, unknown>>(initial: T, rules: { [K in keyof T]?: Validator[] } = {}) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const isInvalid = useCallback(
    (name: keyof T, v: T = values) => (rules[name] ?? []).some((rule) => !rule(v[name])),
    [values],
  );
  const invalid = useMemo(() => Object.keys(values).some((k) => isInvalid(k as keyof T)), [values, isInvalid]);

  const set = useCallback(<K extends keyof T>(name: K, value: T[K]) => setValues((v) => ({ ...v, [name]: value })), []);
  const touch = useCallback((name: keyof T) => setTouched((t) => ({ ...t, [name]: true })), []);
  const touchAll = useCallback(
    () => setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])) as Record<keyof T, boolean>),
    [values],
  );

  /** Propriétés d'un champ texte, liste déroulante ou zone de texte. */
  const text = (name: keyof T) => ({
    name: String(name),
    value: String(values[name] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(name, e.target.value as T[keyof T]),
    onBlur: () => touch(name),
    'aria-invalid': touched[name] && isInvalid(name) ? (true as const) : undefined,
  });

  /** Propriétés d'une case à cocher. */
  const check = (name: keyof T) => ({
    name: String(name),
    checked: Boolean(values[name]),
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(name, e.target.checked as T[keyof T]),
    onBlur: () => touch(name),
  });

  return { values, setValues, set, touched, touch, touchAll, invalid, isInvalid, text, check };
}
