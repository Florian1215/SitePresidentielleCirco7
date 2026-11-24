import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArticleCard } from '../components/ArticleCard';
import { EventCard } from '../components/EventCard';
import { Photo } from '../components/Photo';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { Article, CampaignEvent, Category } from '../lib/models';
import { usePageTitle } from '../lib/title';

/** Agenda : les premiers rendez-vous (3 cartes par ligne, 3 lignes), puis tout l'agenda sur demande. */
/** Rangées de rendez-vous affichées avant « Voir plus » (3 cartes sur mobile, 6 sur tablette, 9 sur ordinateur). */
const EVENT_ROWS = 3;

/** Nombre de colonnes réellement affichées par une grille CSS (suit le redimensionnement de l'écran). */
function useGridColumns(grid: HTMLElement | null, initial: number) {
  const [columns, setColumns] = useState(initial);
  useEffect(() => {
    if (!grid) return;
    const update = () => setColumns(getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [grid]);
  return columns;
}

const CHIP = 'cursor-pointer rounded-full border-2 px-3.5 py-1.5 [font-family:inherit] text-[14px] leading-[inherit] font-bold';
const chip = (on: boolean, white = false) =>
  `${CHIP} ${on ? 'border-violet bg-violet text-creme' : `border-violet text-violet ${white ? 'bg-white' : 'bg-transparent'}`}`;
const CATS = 'flex flex-wrap items-center gap-2';
/** Petit bouton blanc de l'en-tête de l'agenda (Filtres, Vue par carte). */
const HEAD_BTN =
  'inline-flex cursor-pointer items-center gap-2 rounded-full border-0 px-4 py-2 [font-family:inherit] text-[15px] font-bold shadow-site';
const headBtn = (on = false) =>
  `${HEAD_BTN} ${on ? 'bg-violet text-creme' : 'bg-white text-violet hover:bg-violet hover:text-creme'}`;

/** Pictogrammes des boutons Carte / Liste / Filtres — Font Awesome Free 6.7.2 (solid « map », « list », « filter »), CC BY 4.0. */
const VIEW_ICONS = {
  map: {
    viewBox: '0 0 576 512',
    d: 'M384 476.1L192 421.2l0-385.3L384 90.8l0 385.3zm32-1.2l0-386.5L543.1 37.5c15.8-6.3 32.9 5.3 32.9 22.3l0 334.8c0 9.8-6 18.6-15.1 22.3L416 474.8zM15.1 95.1L160 37.2l0 386.5L32.9 474.5C17.1 480.8 0 469.2 0 452.2L0 117.4c0-9.8 6-18.6 15.1-22.3z',
  },
  list: {
    viewBox: '0 0 512 512',
    d: 'M40 48C26.7 48 16 58.7 16 72l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24L40 48zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L192 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zM16 232l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0z',
  },
  filter: {
    viewBox: '0 0 512 512',
    d: 'M3.9 54.9C10.5 40.9 24.5 32 40 32l432 0c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9 320 448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6l0-79.1L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z',
  },
} as const;

/** Carte OpenStreetMap (Leaflet), chargée seulement quand on l'affiche. */
const EventsMap = lazy(() => import('../components/EventsMap'));

/** Bouton « Autres ▾ » : liste de toutes les catégories, pour filtrer les articles. */
function CategoryMenu({
  categories,
  selected,
  onSelect,
  label,
  text,
}: {
  categories: Category[];
  selected: string | null;
  onSelect: (slug: string) => void;
  label: string;
  text: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Fermeture : clic en dehors, Échap
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className={`${chip(open)} inline-flex items-center gap-1.5`}
        aria-expanded={open}
        aria-haspopup="true"
        title={label}
        onClick={() => setOpen(!open)}
      >
        {text}
        <span aria-hidden="true" className={`text-[11px] transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && (
        <ul className="absolute top-[calc(100%+6px)] left-0 z-20 m-0 grid max-h-[320px] min-w-[220px] list-none gap-0.5 overflow-y-auto rounded-lg border border-gris bg-white p-1 shadow-site">
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={selected === c.slug}
                onClick={() => {
                  onSelect(c.slug);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border-0 px-3 py-2 text-left text-[14px] font-bold ${selected === c.slug ? 'bg-lavande text-violet' : 'bg-transparent text-noir hover:bg-lavande'}`}
              >
                {c.name}
                {selected === c.slug && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BlogList() {
  usePageTitle('blog');
  const i18n = useI18n();
  const t = i18n.d.blog;

  // Paramètres d'URL (?page=&search=) ; ?category= présélectionne seulement un filtre
  const [params, setParams] = useSearchParams();
  const page = params.get('page') ?? undefined;
  const search = params.get('search') ?? undefined;
  const category = params.get('category') ?? undefined;

  const go = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, String(v));
    }
    setParams(next);
  };

  // ---------- Agenda ----------
  const [events, setEvents] = useState<CampaignEvent[] | undefined>(undefined);
  const [allEvents, setAllEvents] = useState(false);
  /** Filtre par ville, appliqué sur place (sans recharger la page). */
  const [city, setCity] = useState<string | null>(null);
  /** Filtre par catégorie (projet Zetkin), lui aussi appliqué sur place. */
  const [eventCategory, setEventCategory] = useState('');
  useEffect(() => {
    let alive = true;
    api.events().then((e) => alive && setEvents(e));
    return () => {
      alive = false;
    };
  }, []);

  /** Villes des rendez-vous à venir, de la plus active à la moins active ; « En ligne » en dernier. */
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events ?? []) if (e.city) counts.set(e.city, (counts.get(e.city) ?? 0) + 1);
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort(
        (a, b) =>
          Number(a.name === 'En ligne') - Number(b.name === 'En ligne') || b.count - a.count || i18n.compare(a.name, b.name),
      );
  }, [events, i18n]);
  const filteredEvents = useMemo(() => {
    const list = events ?? [];
    return list.filter((e) => (!city || e.city === city) && (!eventCategory || e.category === eventCategory));
  }, [events, city, eventCategory]);
  /** Catégories des rendez-vous à venir, de la plus fournie à la moins fournie. */
  const eventCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events ?? []) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || i18n.compare(a.name, b.name));
  }, [events, i18n]);
  /** Grille des rendez-vous : on n'en montre que EVENT_ROWS rangées, quel que soit le nombre de colonnes. */
  const [eventsGrid, setEventsGrid] = useState<HTMLUListElement | null>(null);
  const eventsShown = EVENT_ROWS * useGridColumns(eventsGrid, 3);
  const visibleEvents = allEvents ? filteredEvents : filteredEvents.slice(0, eventsShown);

  /** Affichage de l'agenda : cartes des rendez-vous ou carte géographique. */
  const [view, setView] = useState<'list' | 'map'>('list');
  /** Tags de filtre (villes, catégories) : cachés tant qu'on n'a pas cliqué sur « Filtres ». */
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = Number(!!city) + Number(!!eventCategory);
  const unmapped = filteredEvents.filter((e) => e.latitude === null || e.longitude === null).length;

  // ---------- Articles ----------
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /** Filtre par catégorie : les articles de cette catégorie sont chargés depuis le serveur (toutes les pages). */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(category ?? null);
  /** Catégories des deux derniers articles publiés : proposées directement, les autres derrière le bouton « Autres ». */
  const [recentCategories, setRecentCategories] = useState<Category[]>([]);
  const lastCategory = useRef(category);
  if (lastCategory.current !== category) {
    lastCategory.current = category;
    setSelectedCategory(category ?? null);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const pages = Math.max(1, Math.ceil(count / 9));

  useEffect(() => {
    api.categories().then(setCategories, () => {});
    api.articles({ status: 'published' }).then(
      (res) => {
        const seen = new Map<number, Category>();
        for (const a of res.results.slice(0, 2)) if (a.category_detail) seen.set(a.category_detail.id, a.category_detail);
        setRecentCategories([...seen.values()]);
      },
      () => {},
    );
  }, []);

  const selectCategory = (slug: string | null) => {
    setSelectedCategory(slug);
    if (pageNum > 1) go({ page: null });
  };

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    api.articles({ page: pageNum, search, category: selectedCategory ?? undefined }, ctrl.signal).then(
      (res) => {
        setArticles(res.results);
        setCount(res.count);
        setLoading(false);
      },
      (err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setError(true);
        setLoading(false);
      },
    );
    return () => ctrl.abort();
  }, [pageNum, search, selectedCategory]);

  const shownArticles = articles;
  /** Catégories proposées directement : celles des deux derniers articles, plus celle choisie dans la liste « Autres ». */
  const quickCategories = useMemo(() => {
    const list = [...recentCategories];
    const chosen = categories.find((c) => c.slug === selectedCategory);
    if (chosen && !list.some((c) => c.id === chosen.id)) list.push(chosen);
    return list;
  }, [recentCategories, categories, selectedCategory]);

  const searchBox = useRef<HTMLInputElement>(null);

  return (
    <div>
      <section className="page-hero">
        <div className="site-container grid grid-cols-[1.3fr_1fr] items-center gap-10 max-[900px]:grid-cols-1">
          <div className="hero-copy">
            <span className="eyebrow">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p className="lead">{t.lead}</p>
            <div className="btn-row mt-2">
              <Link to={{ search: location.search, hash: 'agenda' }} className="btn">
                {t.seeAgenda}
              </Link>
              <Link to={{ search: location.search, hash: 'articles' }} className="btn btn-outline">
                {t.readArticles}
              </Link>
            </div>
          </div>
          <Photo
            className="aspect-[4/3] overflow-hidden rounded-site"
            name="reunionPublique"
            sizes="(max-width: 900px) 100vw, 460px"
            caption={t.photoCaption}
            position="50% 40%"
            eager
          />
        </div>
      </section>

      {/* AGENDA (calendrier Zetkin) */}
      <section className="section bg-lavande scroll-mt-20" id="agenda">
        <div className="site-container">
          {/* Titre à gauche ; à droite, les boutons Filtres et Vue par carte / liste */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h2 className="m-0">{t.agendaTitle}</h2>
            {events?.length ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={headBtn(showFilters)}
                  aria-expanded={showFilters}
                  aria-controls="agenda-filtres"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <svg className="h-4 w-4 fill-current" viewBox={VIEW_ICONS.filter.viewBox} aria-hidden="true" focusable="false">
                    <path d={VIEW_ICONS.filter.d} />
                  </svg>
                  {t.filters}
                  {activeFilters > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rouge px-1 text-[12px] text-white">
                      {activeFilters}
                    </span>
                  )}
                </button>
                {/* Bascule liste / carte : propose toujours l'autre vue */}
                {(() => {
                  const next = view === 'list' ? 'map' : 'list';
                  const icon = VIEW_ICONS[next];
                  return (
                    <button type="button" className={headBtn()} onClick={() => setView(next)}>
                      <svg className="h-4 w-4 fill-current" viewBox={icon.viewBox} aria-hidden="true" focusable="false">
                        <path d={icon.d} />
                      </svg>
                      {next === 'map' ? t.viewByMap : t.viewByList}
                    </button>
                  );
                })()}
              </div>
            ) : null}
          </div>

          {/* Filtres : une ligne de tags pour les villes, une pour les catégories Zetkin */}
          {events?.length && showFilters ? (
            <div id="agenda-filtres" className="mb-[clamp(28px,4vw,44px)] grid gap-3 rounded-site bg-white/60 p-4">
              {(
                [
                  {
                    label: t.citiesLabel,
                    aria: t.cityFilterAria,
                    items: cities.map((c) => ({ value: c.name, text: i18n.city(c.name), count: c.count })),
                    current: city ?? '',
                    set: (v: string) => setCity(v || null),
                  },
                  {
                    label: t.categoriesLabel,
                    aria: t.categoryFilterAria,
                    items: eventCategories.map((c) => ({ value: c.name, text: c.name, count: c.count })),
                    current: eventCategory,
                    set: setEventCategory,
                  },
                ] as const
              ).map((row) => (
                <div key={row.label} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="w-[90px] text-[13px] font-bold tracking-[0.04em] text-violet uppercase max-[600px]:w-full">
                    {row.label}
                  </span>
                  <div className={CATS} role="group" aria-label={row.aria}>
                    <button
                      type="button"
                      className={chip(!row.current, true)}
                      aria-pressed={!row.current}
                      onClick={() => row.set('')}
                    >
                      {t.allTags}
                    </button>
                    {row.items.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={chip(row.current === item.value, true)}
                        aria-pressed={row.current === item.value}
                        onClick={() => row.set(item.value)}
                      >
                        {item.text} <span className="ml-1 text-[12px] opacity-70">{item.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {events === undefined ? (
            <p className="loader">{t.loadingAgenda}</p>
          ) : !events.length ? (
            <p className="muted">{t.noEvents}</p>
          ) : view === 'map' ? (
            <>
              <Suspense fallback={<p className="loader">{t.loadingAgenda}</p>}>
                <EventsMap events={filteredEvents} />
              </Suspense>
              {unmapped > 0 && <p className="muted mt-4 mb-0 text-[14px]">{i18n.f(t.eventsUnmapped, { n: unmapped })}</p>}
            </>
          ) : (
            <>
              <ul className="grid grid-3 m-0 list-none p-0" ref={setEventsGrid}>
                {visibleEvents.map((e) => (
                  <li key={e.id}>
                    <EventCard event={e} />
                  </li>
                ))}
              </ul>
              {filteredEvents.length > eventsShown && (
                <div className="mt-7 flex justify-center">
                  <button type="button" className="btn btn-outline" onClick={() => setAllEvents(!allEvents)}>
                    {allEvents ? t.showLess : i18n.f(t.showMore, { n: filteredEvents.length - eventsShown })}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ARTICLES */}
      <section className="section scroll-mt-20" id="articles">
        <div className="site-container">
          <div className="section-head">
            <span className="eyebrow">{t.blogEyebrow}</span>
            <h2>{t.articlesTitle}</h2>
          </div>
          <div className="mb-8 flex flex-wrap justify-between gap-4">
            <form
              className="flex max-w-[480px] flex-[1_1_320px] gap-2"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                go({ search: searchBox.current?.value || null, page: null });
              }}
            >
              <label htmlFor="blog-search" className="visually-hidden">
                {t.search}
              </label>
              <input
                ref={searchBox}
                key={search ?? ''}
                id="blog-search"
                type="search"
                className="px-3.5 py-2.5"
                placeholder={t.searchPlaceholder}
                defaultValue={search ?? ''}
              />
              <button className="btn btn-sm" type="submit">
                {t.search}
              </button>
            </form>
            <div className={CATS}>
              {categories.length > 0 && (
                <>
                  <button
                    type="button"
                    className={chip(!selectedCategory)}
                    aria-pressed={!selectedCategory}
                    onClick={() => selectCategory(null)}
                  >
                    {t.allCategories}
                  </button>
                  {quickCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={chip(selectedCategory === c.slug)}
                      aria-pressed={selectedCategory === c.slug}
                      onClick={() => selectCategory(c.slug)}
                    >
                      {c.name}
                    </button>
                  ))}
                  <CategoryMenu
                    categories={categories}
                    selected={selectedCategory}
                    onSelect={selectCategory}
                    label={t.moreCategories}
                    text={t.otherCategories}
                  />
                </>
              )}
            </div>
          </div>

          {loading ? (
            <p className="loader">{t.loading}</p>
          ) : error ? (
            <div className="alert alert-err">{t.loadError}</div>
          ) : !articles.length ? (
            <p className="loader">{t.noArticles}</p>
          ) : (
            <>
              <div className="grid grid-3">
                {shownArticles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
              {pages > 1 && (
                <nav className="mt-10 flex items-center justify-center gap-4 font-bold" aria-label={t.pagination}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={pageNum <= 1}
                    onClick={() => go({ page: pageNum - 1 })}
                  >
                    {t.prev}
                  </button>
                  <span>{i18n.f(t.page, { n: pageNum, total: pages })}</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={pageNum >= pages}
                    onClick={() => go({ page: pageNum + 1 })}
                  >
                    {t.next}
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
