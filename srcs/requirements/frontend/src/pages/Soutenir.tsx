import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { FOOTER_ICONS } from '../components/footer-icons';
import { Photo } from '../components/Photo';
import { SupportMelenchon } from '../components/SupportMelenchon';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { networkColor } from '../lib/networks';
import type { EngageForms, SocialLink } from '../lib/models';
import { usePageTitle } from '../lib/title';

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
      <section className="page-hero overflow-hidden py-[clamp(40px,5.5vw,68px)]!">
        <div className="site-container text-center">
          <div className="mx-auto max-w-[760px]">
            <h1 className="text-[clamp(26px,6vw,72px)] whitespace-nowrap">{t.title}</h1>
            <p className="lead mx-auto">{t.lead}</p>
          </div>

          <Photo
            className="mt-6 aspect-[16/9] overflow-hidden rounded-site shadow-[14px_14px_0_var(--color-rouge)] max-[700px]:mx-auto max-[700px]:aspect-[4/3] max-[700px]:w-[calc(100%-8px)] max-[700px]:shadow-[8px_8px_0_var(--color-rouge)]"
            name="equipeBerlin"
            sizes="(max-width: 1248px) 100vw, 1200px"
            caption={t.photoCaption}
          />

          {socials.length > 0 && (
            <>
              <h2 className="mt-14 mb-6 text-[clamp(28px,3.4vw,40px)]">{t.followTitle}</h2>
              <ul
                className="mx-auto my-0 grid max-w-[720px] list-none grid-cols-3 gap-4 p-0 max-[600px]:grid-cols-2"
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
                        className="flex items-center gap-3 rounded-site bg-(--c) px-5 py-4 text-[17px] font-bold text-white no-underline shadow-site transition-transform hover:-translate-y-0.5 hover:text-white hover:no-underline"
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

          <div className="btn-row mt-12 justify-center">
            <Link to="/blog#agenda" className="btn">
              {t.seeEvents} →
            </Link>
          </div>
        </div>
      </section>

      {/* 2. JE SOUTIENS JEAN-LUC MÉLENCHON (même encart que l'accueil) */}
      <SupportMelenchon id="melenchon" />

      {/* 3. JE M'ENGAGE DANS LA CAMPAGNE : photo, choix de la ville, puis formulaire Zetkin de cette ville */}
      <section className="section" id="engagement">
        <div className="site-container grid grid-cols-[1fr_1fr] items-center gap-12 max-[900px]:grid-cols-1">
          <Photo
            className="aspect-[4/3] overflow-hidden rounded-site shadow-[14px_14px_0_var(--color-violet)] max-[900px]:mx-auto max-[900px]:w-[calc(100%-8px)] max-[900px]:max-w-[620px] max-[900px]:shadow-[8px_8px_0_var(--color-violet)]"
            name="standLfi"
            sizes="(max-width: 900px) 100vw, 600px"
          />
          <div>
            <span className="eyebrow">{t.engageEyebrow}</span>
            <h2>{t.engageTitle}</h2>
            <p className="lead">{t.engageLead}</p>
            <EngageChooser />
          </div>
        </div>
      </section>
    </div>
  );
}

/** Recherche sans tenir compte des accents ni de la casse : « dusseldorf » trouve Düsseldorf. */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .trim();

const MAX_SUGGESTIONS = 8;

/**
 * « Je viens de [ville] » + « Je m'engage » : envoie vers le formulaire Zetkin de la ville, sinon vers le formulaire
 * par défaut (admin Django → Formulaires « Je m'engage »).
 * La ville se tape librement, avec des suggestions : nom français, anglais ou allemand (« Wien » → Vienne).
 * Une ville qui n'est pas dans la liste mène au formulaire par défaut.
 */
function EngageChooser() {
  const i18n = useI18n();
  const t = i18n.d.supportPage;
  const [forms, setForms] = useState<EngageForms | null>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  /** Suggestion mise en avant au clavier (-1 : aucune). */
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const ctrl = new AbortController();
    api.engageForms(ctrl.signal).then(setForms, () => {});
    return () => ctrl.abort();
  }, []);

  /** Villes avec leur nom affiché et tous les noms qui permettent de la trouver. */
  const cities = useMemo(
    () =>
      (forms?.cities ?? []).map((c) => {
        const label = i18n.city(c.name);
        const names = [c.name, label, en.cities[c.name], de.cities[c.name]].filter((n): n is string => !!n);
        return { ...c, label, keys: [...new Set(names.map(fold))] };
      }),
    [forms, i18n],
  );

  const query = fold(text);
  const suggestions = useMemo(() => {
    if (!query) return [];
    const starts = cities.filter((c) => c.keys.some((k) => k.startsWith(query)));
    const contains = cities.filter((c) => !starts.includes(c) && c.keys.some((k) => k.includes(query)));
    const byLabel = (a: (typeof cities)[number], b: (typeof cities)[number]) => i18n.compare(a.label, b.label);
    return [...starts.sort(byLabel), ...contains.sort(byLabel)].slice(0, MAX_SUGGESTIONS);
  }, [cities, query, i18n]);

  /** Ville reconnue dans le texte tapé (nom exact, dans l'une des langues). */
  const match = query ? cities.find((c) => c.keys.includes(query)) : undefined;
  const target = !query ? null : (match?.url ?? forms?.default_url ?? null);
  const showList = open && suggestions.length > 0 && !(suggestions.length === 1 && suggestions[0] === match);

  const choose = (label: string) => {
    setText(label);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!suggestions.length) return;
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // Parcours en boucle : … dernière suggestion → champ (-1) → première suggestion …
      setActive((i) => {
        const next = i + step;
        return next >= suggestions.length ? -1 : next < -1 ? suggestions.length - 1 : next;
      });
    } else if (e.key === 'Enter' && showList && active >= 0 && active < suggestions.length) {
      e.preventDefault(); // Entrée sur une suggestion : on la choisit, sans encore envoyer
      choose(suggestions[active].label);
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  const go = (e: FormEvent) => {
    e.preventDefault();
    // Formulaire Zetkin dans un nouvel onglet : le site reste ouvert
    if (target) window.open(target, '_blank', 'noopener');
  };

  return (
    <form onSubmit={go} className="mt-8 flex flex-wrap items-end gap-3 rounded-site bg-lavande p-4">
      <div className="field relative m-0 min-w-[220px] flex-1">
        <label htmlFor="engage-city" className="font-bold text-violet">
          {t.fromLabel}
        </label>
        <input
          id="engage-city"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls="engage-city-list"
          aria-activedescendant={showList && active >= 0 && active < suggestions.length ? `engage-city-${active}` : undefined}
          placeholder={t.cityPlaceholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <ul
          id="engage-city-list"
          role="listbox"
          aria-label={t.fromLabel}
          hidden={!showList}
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 m-0 max-h-[320px] list-none overflow-auto rounded-xl bg-white p-1.5 shadow-[0_14px_34px_rgba(33,35,32,.2)]"
        >
          {suggestions.map((c, i) => (
            <li
              key={c.name}
              id={`engage-city-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer rounded-lg px-3 py-2 text-[15px] font-semibold ${i === active ? 'bg-lavande text-violet' : 'text-noir hover:bg-lavande hover:text-violet'}`}
              // mousedown (et non click) : le choix est pris avant que le champ perde le focus
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c.label);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {c.label}
            </li>
          ))}
        </ul>
      </div>
      <button className="btn btn-rouge" type="submit" disabled={!target}>
        {t.submit}
        <span aria-hidden="true">↗</span>
        <span className="visually-hidden"> {t.newTab}</span>
      </button>
    </form>
  );
}
