import { useId, useState } from 'react';
import type { Signer, Signers } from '../lib/models';

/** Recherche sans tenir compte des accents ni de la casse. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PILL =
  'inline-flex items-center gap-1 rounded-full py-1 pr-1.5 pl-3 text-[14px] font-bold [&_button]:grid [&_button]:h-5 [&_button]:w-5 [&_button]:cursor-pointer [&_button]:place-items-center [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[16px] [&_button]:leading-none [&_button]:text-inherit [&_button:hover]:bg-black/10';

/**
 * Champ « Auteur·ices » de l'éditeur : signatures collectives (Berlin Insoumise…) à cocher,
 * et comptes rédacteurs à ajouter avec une petite recherche.
 */
export function SignaturePicker({
  options,
  authors,
  collectives,
  meId,
  onChange,
}: {
  options: Signers;
  authors: Signer[];
  collectives: number[];
  meId?: number;
  onChange: (authors: Signer[], collectives: number[]) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const chosen = new Set(authors.map((a) => a.id));
  const q = fold(query.trim());
  const matches = q ? options.authors.filter((u) => !chosen.has(u.id) && fold(u.name).includes(q)).slice(0, 6) : [];
  const me = meId !== undefined ? options.authors.find((u) => u.id === meId) : undefined;

  const add = (u: Signer) => {
    onChange([...authors, u], collectives);
    setQuery('');
  };
  const remove = (uid: number) =>
    onChange(
      authors.filter((a) => a.id !== uid),
      collectives,
    );
  const toggleCollective = (cid: number) =>
    onChange(authors, collectives.includes(cid) ? collectives.filter((c) => c !== cid) : [...collectives, cid]);

  return (
    <div className="field">
      <span className="text-[14px] font-bold" id={`${id}-label`}>
        Auteur·ices
      </span>

      {options.collectives.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-label`}>
          {options.collectives.map((c) => {
            const on = collectives.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCollective(c.id)}
                className={`cursor-pointer rounded-full border-2 border-rouge px-3 py-1 [font-family:inherit] text-[14px] font-bold ${
                  on ? 'bg-rouge text-white' : 'bg-white text-rouge hover:bg-rose'
                }`}
              >
                {on ? '✓ ' : '+ '}
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {authors.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Auteur·ices choisi·es">
          {authors.map((a) => (
            <li key={a.id} className={`${PILL} bg-lavande text-violet`}>
              {a.id === meId ? `${a.name} (moi)` : a.name}
              <button type="button" onClick={() => remove(a.id)} aria-label={`Retirer ${a.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <label htmlFor={`${id}-search`} className="visually-hidden">
          Ajouter un·e auteur·ice
        </label>
        <input
          id={`${id}-search`}
          type="search"
          placeholder="Ajouter un·e auteur·ice…"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (matches[0]) add(matches[0]);
            }
          }}
        />
        {q && (
          <ul className="absolute top-full right-0 left-0 z-10 m-0 mt-1 list-none overflow-hidden rounded-lg border border-gris bg-white p-0 shadow-site">
            {matches.length ? (
              matches.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left [font-family:inherit] text-[15px] hover:bg-lavande"
                    onClick={() => add(u)}
                  >
                    {u.name}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-[14px] text-texte">Aucun compte rédacteur à ce nom.</li>
            )}
          </ul>
        )}
      </div>

      {me && !chosen.has(me.id) && (
        <button type="button" className="btn-link justify-self-start text-[14px]" onClick={() => add(me)}>
          + M'ajouter
        </button>
      )}
      <span className="hint">Choisissez une signature collective, des comptes, ou les deux.</span>
    </div>
  );
}
