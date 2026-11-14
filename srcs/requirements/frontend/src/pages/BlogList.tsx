import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArticleCard } from '../components/ArticleCard';
import { EventCard } from '../components/EventCard';
import { Photo } from '../components/Photo';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import type { Article, CampaignEvent, Category } from '../lib/models';
import { usePageTitle } from '../lib/title';

/** Agenda : les premiers rendez-vous (3 cartes par ligne, 3 lignes), puis tout l'agenda sur demande. */
const EVENTS_SHOWN = 9;

const CHIP = 'cursor-pointer rounded-full border-2 px-3.5 py-1.5 [font-family:inherit] text-[14px] leading-[inherit] font-bold';
const chip = (on: boolean, alt = false, white = false) =>
  `${CHIP} ${
    alt
      ? on
        ? 'border-rouge bg-rouge text-creme'
        : 'border-rouge bg-transparent text-rouge'
      : on
        ? 'border-violet bg-violet text-creme'
        : `border-violet text-violet ${white ? 'bg-white' : 'bg-transparent'}`
  }`;
const CATS = 'flex flex-wrap items-center gap-2';

export default function BlogList() {
  usePageTitle('blog');
  const i18n = useI18n();
  const t = i18n.d.blog;
  const auth = useAuth();

  // Paramètres d'URL (?page=&search=&mine=) ; ?category= présélectionne seulement un filtre
  const [params, setParams] = useSearchParams();
  const page = params.get('page') ?? undefined;
  const search = params.get('search') ?? undefined;
  const category = params.get('category') ?? undefined;
  const mine = params.get('mine') ?? undefined;

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
    return city ? list.filter((e) => e.city === city) : list;
  }, [events, city]);
  const visibleEvents = allEvents ? filteredEvents : filteredEvents.slice(0, EVENTS_SHOWN);

  // ---------- Articles ----------
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /** Filtre par catégorie, appliqué sur place aux articles déjà affichés (sans recharger la page). */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(category ?? null);
  const lastCategory = useRef(category);
  if (lastCategory.current !== category) {
    lastCategory.current = category;
    setSelectedCategory(category ?? null);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const pages = Math.max(1, Math.ceil(count / 9));

  useEffect(() => {
    api.categories().then(setCategories, () => {});
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    api.articles({ page: pageNum, search, mine: !!mine }, ctrl.signal).then(
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
  }, [pageNum, search, mine]);

  const shownArticles = selectedCategory ? articles.filter((a) => a.category_detail?.slug === selectedCategory) : articles;
  /** Seules les catégories présentes parmi les articles affichés sont proposées. */
  const shownCategories = useMemo(() => {
    const used = new Set(articles.map((a) => a.category));
    return categories.filter((c) => used.has(c.id));
  }, [articles, categories]);

  const searchBox = useRef<HTMLInputElement>(null);

  return (
    <div>
      <section className="page-hero">
        <div className="site-container grid grid-cols-[1.3fr_1fr] items-center gap-10 max-[900px]:grid-cols-1">
          <div>
            <span className="eyebrow">{t.eyebrow}</span>
            <h1>{mine ? t.mine : t.title}</h1>
            <p className="lead">{t.lead}</p>
            {!mine && (
              <div className="btn-row mt-2">
                <Link to={{ search: location.search, hash: 'agenda' }} className="btn">
                  {t.seeAgenda}
                </Link>
                <Link to={{ search: location.search, hash: 'articles' }} className="btn btn-outline">
                  {t.readArticles}
                </Link>
              </div>
            )}
            {auth.canWrite && (
              <Link to="/blog/ecrire" className="btn btn-rouge mt-4">
                {t.write}
              </Link>
            )}
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
      {!mine && (
        <section className="section bg-lavande scroll-mt-20" id="agenda">
          <div className="site-container">
            {/* Titre à gauche, tags des villes à droite */}
            <div className="mb-[clamp(28px,4vw,44px)] flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
              <h2 className="m-0">{t.agendaTitle}</h2>
              {cities.length > 1 && (
                // Sous le titre sur petit écran
                <div className={`${CATS} justify-end max-[900px]:justify-start`} role="group" aria-label={t.cityFilterAria}>
                  <button type="button" className={chip(!city, false, true)} aria-pressed={!city} onClick={() => setCity(null)}>
                    {t.allCities}
                  </button>
                  {cities.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={chip(city === c.name, false, true)}
                      aria-pressed={city === c.name}
                      onClick={() => setCity(c.name)}
                    >
                      {i18n.city(c.name)} <span className="ml-1 text-[12px] opacity-70">{c.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {events === undefined ? (
              <p className="loader">{t.loadingAgenda}</p>
            ) : !events.length ? (
              <p className="muted">{t.noEvents}</p>
            ) : (
              <>
                <ul className="grid grid-3 m-0 list-none p-0">
                  {visibleEvents.map((e) => (
                    <li key={e.id}>
                      <EventCard event={e} />
                    </li>
                  ))}
                </ul>
                {filteredEvents.length > EVENTS_SHOWN && (
                  <div className="mt-7 flex justify-center">
                    <button type="button" className="btn btn-outline" onClick={() => setAllEvents(!allEvents)}>
                      {allEvents ? t.showLess : i18n.f(t.showMore, { n: filteredEvents.length - EVENTS_SHOWN })}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ARTICLES */}
      <section className="section scroll-mt-20" id="articles">
        <div className="site-container">
          {!mine && (
            <div className="section-head">
              <span className="eyebrow">{t.blogEyebrow}</span>
              <h2>{t.articlesTitle}</h2>
            </div>
          )}
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
              {shownCategories.length > 0 && (
                <>
                  <button type="button" className={chip(!selectedCategory)} aria-pressed={!selectedCategory} onClick={() => setSelectedCategory(null)}>
                    {t.allCategories}
                  </button>
                  {shownCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={chip(selectedCategory === c.slug)}
                      aria-pressed={selectedCategory === c.slug}
                      onClick={() => setSelectedCategory(c.slug)}
                    >
                      {c.name}
                    </button>
                  ))}
                </>
              )}
              {auth.canWrite && (
                <button type="button" className={chip(!!mine, true)} onClick={() => go({ mine: mine ? null : 1, page: null })}>
                  {t.mine}
                </button>
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
                  <button type="button" className="btn btn-outline btn-sm" disabled={pageNum <= 1} onClick={() => go({ page: pageNum - 1 })}>
                    {t.prev}
                  </button>
                  <span>{i18n.f(t.page, { n: pageNum, total: pages })}</span>
                  <button type="button" className="btn btn-outline btn-sm" disabled={pageNum >= pages} onClick={() => go({ page: pageNum + 1 })}>
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
