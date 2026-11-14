import { useEffect, useRef, useState } from 'react';
import { LANGS, useI18n } from '../lib/i18n';
import type { Lang } from '../lib/i18n';

/** Bouton des langues (en haut à droite) : ouvre un petit menu Français / English / Deutsch. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const i18n = useI18n();
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (refocus: boolean) => {
      setOpen(false);
      if (refocus) toggle.current?.focus();
    };
    const onClick = (e: MouseEvent) => {
      if (!host.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (code: Lang) => {
    i18n.set(code);
    setOpen(false);
    toggle.current?.focus();
  };

  return (
    <div ref={host} className={`relative block ${className}`}>
      <button
        ref={toggle}
        type="button"
        className="inline-grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-violet opacity-75 transition-[background,opacity] duration-150 ease-[ease] hover:bg-lavande hover:opacity-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-jaune aria-expanded:bg-lavande aria-expanded:opacity-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="lang-menu"
        aria-label={i18n.d.nav.chooseLanguage}
        title={i18n.d.nav.chooseLanguage}
        onClick={() => setOpen(!open)}
      >
        <svg
          className="h-[22px] w-[22px] fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M2.5 12h19M12 2.5c2.6 2.6 4 6 4 9.5s-1.4 6.9-4 9.5c-2.6-2.6-4-6-4-9.5s1.4-6.9 4-9.5z" />
        </svg>
      </button>
      {open && (
        <ul
          id="lang-menu"
          className="absolute top-[calc(100%+8px)] right-0 z-60 m-0 min-w-[190px] list-none rounded-xl bg-white p-1.5 shadow-[0_14px_34px_rgba(33,35,32,.2)]"
          role="menu"
          aria-label={i18n.d.nav.language}
        >
          {LANGS.map((l) => {
            const on = l.code === i18n.lang;
            return (
              <li key={l.code} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  lang={l.code}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left [font-family:inherit] text-[15px] leading-[inherit] font-semibold hover:bg-lavande hover:text-violet focus-visible:bg-lavande focus-visible:text-violet focus-visible:outline-none ${on ? 'text-violet' : 'text-noir'}`}
                  onClick={() => choose(l.code)}
                >
                  <span
                    className={`inline-grid h-[22px] w-[30px] place-items-center rounded-[5px] text-[12px] font-extrabold ${on ? 'bg-violet text-creme' : 'bg-gris-clair text-violet'}`}
                    aria-hidden="true"
                  >
                    {l.short}
                  </span>
                  {l.label}
                  {on && (
                    <span className="ml-auto font-black text-rouge" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
