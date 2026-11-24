import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { CalendarIcon, CalendarSubscribeDialog } from '../components/CalendarSubscribe';
import type { CalendarFeed } from '../components/CalendarSubscribe';
import { ArticleCard } from '../components/ArticleCard';
import { EventCard } from '../components/EventCard';
import { FOOTER_ICONS } from '../components/footer-icons';
import { MAP_COUNTRIES, project } from '../data/europe-map';
import { QrLink } from '../components/QrLink';
import { api, apiErrorMessage } from '../lib/api';
import type { GroupImageField } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import type { ActionGroupDetail, ActionGroupLink, Article, GroupPhoto, GroupVisits } from '../lib/models';
import { networkColor, networkName } from '../lib/networks';
import { usePageTitle } from '../lib/title';
import { recordGroupVisit } from '../lib/tracker';

/** Adresse publique de la page d'un groupe, dans une langue (lien partagé, QR code). */
export const groupPageUrl = (slug: string, lang: Lang) => `${window.location.origin}/groupes/${slug}?lang=${lang}`;

/**
 * Page d'un groupe d'action (/groupes/:slug ; les anciennes adresses /groupes/:id redirigent) : réseaux sociaux, lien « Je m'engage », présentation, carte, photos et
 * prochains événements de sa ville. Ses membres (et les admins) ont en haut une barre pour la modifier
 * et créer un QR code vers la page.
 */
/** --cover-h : hauteur de l'image d'en-tête (comme sur les articles). */
const COVER = { '--cover-h': 'clamp(380px, 58vw, 760px)' } as CSSProperties;

export default function GroupPage() {
  const { slug: key = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const i18n = useI18n();
  const t = i18n.d.groupPage;
  const [group, setGroup] = useState<ActionGroupDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notFound' | 'error'>('loading');
  const [feed, setFeed] = useState<CalendarFeed | null>(null);
  const [zoomed, setZoomed] = useState<GroupPhoto | null>(null);
  /** Articles publiés au nom du groupe (les plus récents). */
  const [articles, setArticles] = useState<Article[]>([]);

  usePageTitle(group ? `${group.name} — ${i18n.d.titles.suffix}` : state === 'notFound' ? 'notFound' : null);

  useEffect(() => {
    // Groupe déjà affiché (adresse /groupes/12 remplacée par /groupes/<slug>) : pas de rechargement
    if (group && (group.slug === key || String(group.id) === key)) return;
    const ctrl = new AbortController();
    setState('loading');
    api.actionGroup(key, ctrl.signal).then(
      (g) => {
        setGroup(g);
        recordGroupVisit(g.id);
        setState('ok');
        // Ancienne adresse par identifiant : on affiche l'adresse avec le nom du groupe
        if (key !== g.slug) navigate(`/groupes/${g.slug}${location.search}${location.hash}`, { replace: true });
      },
      (err) => {
        if ((err as Error)?.name === 'AbortError') return;
        setState((err as { status?: number })?.status === 404 ? 'notFound' : 'error');
      },
    );
    return () => ctrl.abort();
  }, [key]);

  const groupId = group?.id;
  useEffect(() => {
    const ctrl = new AbortController();
    setArticles([]);
    if (!groupId) return;
    api.articles({ actionGroup: groupId, status: 'published' }, ctrl.signal).then(
      (res) => setArticles(res.results.slice(0, 6)),
      () => {},
    );
    return () => ctrl.abort();
  }, [groupId]);

  if (state === 'loading') {
    return (
      <section className="section">
        <div className="site-container">
          <p className="loader">{t.loading}</p>
        </div>
      </section>
    );
  }
  if (!group) {
    return (
      <section className="section">
        <div className="site-container max-w-[820px]">
          <p className={`alert ${state === 'notFound' ? 'alert-info' : 'alert-err'}`}>
            {state === 'notFound' ? t.notFound : i18n.d.errors.generic}
          </p>
          <Link to="/circonscription#carte" className="btn btn-outline">
            {t.allGroups}
          </Link>
        </div>
      </section>
    );
  }

  const g = group;
  const place = [g.city, i18n.country(g.country)].filter(Boolean).join(' · ');
  const calendar = g.calendar_slug && g.calendar_city ? { city: g.calendar_city, slug: g.calendar_slug } : null;

  return (
    <div>
      {g.can_edit && <EditorBar group={g} onChange={setGroup} />}

      {/* EN-TÊTE : nom, lieu, réseaux sociaux mis en avant, boutons d'engagement */}
      {/* Avec une image d'en-tête : même effet que les articles, l'image en fond qui se fond vers le texte */}
      <section
        className={`page-hero border-b-0 relative overflow-hidden ${g.cover ? 'pt-[calc(var(--cover-h)-110px)]! pb-[clamp(36px,5vw,64px)]!' : 'py-[clamp(36px,5vw,64px)]!'}`}
        style={g.cover ? COVER : undefined}
      >
        {g.cover && (
          // Légère ombre en haut (lien retour) et fondu vers le fond crème en bas
          <div
            className="absolute inset-x-0 top-0 h-(--cover-h) overflow-hidden after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(33,35,32,.3)_0,rgba(33,35,32,0)_120px),linear-gradient(180deg,rgba(255,252,244,0)_70%,rgba(255,252,244,.85)_90%,var(--color-creme)_100%)] after:content-['']"
            aria-hidden="true"
          >
            <img className="block h-full w-full object-cover object-center" src={g.cover} alt="" fetchPriority="high" />
          </div>
        )}
        <div className="site-container relative z-1">
          <Link
            to="/circonscription#carte"
            className={`text-[14px] font-bold no-underline ${g.cover ? 'absolute top-[calc(-1*var(--cover-h)+110px+28px)] rounded-full bg-[rgba(255,252,244,.92)] px-3 py-1.5' : ''}`}
          >
            {t.allGroups}
          </Link>
          <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-x-12 gap-y-8 max-[900px]:grid-cols-1">
            <div className="min-w-0">
              <div className="flex items-center gap-6 max-[560px]:flex-col max-[560px]:items-start">
                {g.logo && (
                  <img
                    src={g.logo}
                    alt=""
                    className="h-[clamp(88px,12vw,140px)] w-[clamp(88px,12vw,140px)] shrink-0 rounded-site object-cover shadow-site"
                  />
                )}
                <div>
                  <span className="eyebrow">{t.eyebrow}</span>
                  <h1 className="mb-2 text-[clamp(32px,5.5vw,64px)]">{g.name}</h1>
                  {place && <p className="lead m-0">{place}</p>}
                </div>
              </div>

              {/* Présentation courte (300 caractères au plus) */}
              {g.description && (
                <p className="mt-5 mb-0 max-w-[640px] text-[17px] whitespace-pre-line text-noir">{g.description}</p>
              )}

              <div className="btn-row mt-8">
                {g.engage_url && (
                  <a href={g.engage_url} target="_blank" rel="noopener" className="btn btn-rouge">
                    {t.engage} <span aria-hidden="true">↗</span>
                    <span className="visually-hidden"> {t.newTab}</span>
                  </a>
                )}
                <a href={g.url} target="_blank" rel="noopener" className="btn bg-jaune! text-noir! hover:brightness-95">
                  <NetworkIcon network="actionpopulaire" className="h-5 w-5" />
                  {t.joinOnAp} <span aria-hidden="true">↗</span>
                  <span className="visually-hidden"> {t.newTab}</span>
                </a>
              </div>

              {/* Réseaux sociaux : petites pastilles discrètes, couleur du réseau au survol */}
              {g.links.length > 0 && (
                <>
                  <h2 className="visually-hidden">{t.followTitle}</h2>
                  <ul className="mt-5 mb-0 flex list-none flex-wrap gap-2 p-0" aria-label={t.networksAria}>
                    {g.links.map((link) => (
                      <li key={link.url}>
                        <NetworkTile link={link} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <GroupMiniMap group={g} label={i18n.f(t.mapAria, { name: g.name })} />
          </div>
        </div>
      </section>

      {/* PHOTOS */}
      {g.photos.length > 0 && (
        <section className="py-[clamp(20px,3vw,36px)]" id="photos" aria-label={t.photosTitle}>
          <PhotoStrip photos={g.photos} onOpen={setZoomed} label={t.photosTitle} />
        </section>
      )}

      {/* PROCHAINS ÉVÉNEMENTS (ville de l'agenda du groupe) */}
      <section className="section-sm" id="agenda">
        <div className="site-container">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="m-0 text-[clamp(26px,3vw,38px)]">{t.eventsTitle}</h2>
            {calendar && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setFeed(calendar)}>
                <CalendarIcon className="h-4 w-4" /> {t.subscribe}
              </button>
            )}
          </div>
          {g.events.length ? (
            <ul className="grid grid-3 m-0 list-none p-0">
              {g.events.map((e) => (
                <li key={e.id}>
                  <EventCard event={e} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted m-0">{t.noEvents}</p>
          )}
        </div>
      </section>

      {/* ARTICLES publiés au nom du groupe */}
      {articles.length > 0 && (
        <section className="section-sm bg-gris-clair" id="articles">
          <div className="site-container">
            <h2 className="text-[clamp(26px,3vw,38px)]">{t.articlesTitle}</h2>
            <div className="grid grid-3">
              {articles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CalendarSubscribeDialog feed={feed} onClose={() => setFeed(null)} />
      <PhotoDialog photo={zoomed} onClose={() => setZoomed(null)} closeLabel={t.close} />
    </div>
  );
}

function NetworkIcon({ network, className }: { network: string; className: string }) {
  const icon = FOOTER_ICONS[network] ?? FOOTER_ICONS['other'];
  return (
    <svg className={`shrink-0 fill-current ${className}`} viewBox={icon.viewBox} aria-hidden="true" focusable="false">
      <path d={icon.d} />
    </svg>
  );
}

/** Petite pastille ronde d'un réseau social : discrète, aux couleurs du réseau au survol (nom en infobulle). */
function NetworkTile({ link }: { link: ActionGroupLink }) {
  const name = networkName(link.network);
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener"
      title={name}
      aria-label={name}
      style={{ '--c': networkColor(link.network) } as CSSProperties}
      className="grid h-9 w-9 place-items-center rounded-full border border-gris bg-white text-texte no-underline transition-colors hover:border-(--c) hover:bg-(--c) hover:text-white"
    >
      <NetworkIcon network={link.network} className="h-[18px] w-[18px]" />
    </a>
  );
}

/**
 * Bandeau de photos sur toute la largeur, qui défile en continu, en boucle, sans jamais s'arrêter.
 * Hauteur fixe ; chaque photo garde son format d'origine (largeur variable). Légende au survol seulement.
 * La liste est répétée pour remplir l'écran, puis doublée : l'animation avance d'une moitié et recommence sans saut.
 * Mouvement réduit demandé par le système : pas d'animation, défilement à la main.
 */
function PhotoStrip({ photos, onOpen, label }: { photos: GroupPhoto[]; onOpen: (p: GroupPhoto) => void; label: string }) {
  const reps = Math.max(1, Math.ceil(8 / photos.length));
  const loop = Array.from({ length: reps * 2 }, () => photos).flat();
  const style = { '--strip-gap': '16px', '--strip-duration': `${reps * photos.length * 6}s` } as CSSProperties;
  return (
    <div className="overflow-hidden motion-reduce:overflow-x-auto" style={style}>
      <ul className="m-0 flex w-max list-none gap-(--strip-gap) p-0 animate-photo-strip will-change-transform motion-reduce:animate-none">
        {loop.map((p, i) => {
          // Seule la première série est accessible : les copies ne servent qu'à la boucle
          const copy = i >= photos.length;
          return (
            <li key={i} aria-hidden={copy || undefined} className={copy ? 'motion-reduce:hidden' : ''}>
              <figure className="group/photo relative m-0 overflow-hidden rounded-site bg-gris-clair">
                <button
                  type="button"
                  tabIndex={copy ? -1 : undefined}
                  className="block cursor-zoom-in border-0 bg-transparent p-0"
                  onClick={() => onOpen(p)}
                  aria-label={p.caption || label}
                >
                  <img
                    src={p.url}
                    alt={copy ? '' : p.caption}
                    decoding="async"
                    className="block h-[clamp(180px,22vw,300px)] w-auto max-w-none"
                  />
                </button>
                {p.caption && (
                  <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(33,35,32,.75))] px-3 pt-6 pb-2 text-[14px] text-white opacity-0 transition-opacity duration-200 group-hover/photo:opacity-100 group-focus-within/photo:opacity-100">
                    {p.caption}
                  </figcaption>
                )}
              </figure>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Taille de la fenêtre de la petite carte, en unités du fond de carte (≈ 50 unités par degré de latitude). */
const MINI_W = 760;
const MINI_H = 600;

/**
 * Petite carte stylisée (même fond que la carte des groupes) centrée sur le groupe. Le groupe couvre toute une ville
 * ou une région : un point entouré d'un large halo, pas un repère précis.
 */
function GroupMiniMap({ group, label }: { group: ActionGroupDetail; label: string }) {
  const [x, y] = project(group.longitude, group.latitude);
  return (
    <svg
      className="block aspect-[760/600] w-[clamp(260px,30vw,400px)] rounded-site bg-[#e6eef8] shadow-site max-[900px]:w-full max-[900px]:max-w-[420px]"
      viewBox={`${x - MINI_W / 2} ${y - MINI_H / 2} ${MINI_W} ${MINI_H}`}
      role="img"
      aria-label={label}
    >
      {MAP_COUNTRIES.map((c, i) => (
        <path
          key={i}
          d={c.d}
          className={`stroke-1 [vector-effect:non-scaling-stroke] ${
            c.code === group.country
              ? 'fill-violet-vif stroke-[rgba(255,252,244,0.8)]'
              : c.code
                ? 'fill-violet stroke-[rgba(255,252,244,0.7)]'
                : 'fill-[#f1ece0] stroke-white'
          }`}
        />
      ))}
      <circle cx={x} cy={y} r={70} className="fill-jaune opacity-35" />
      <circle cx={x} cy={y} r={38} className="fill-jaune opacity-50" />
      <circle cx={x} cy={y} r={13} className="fill-rouge stroke-white stroke-[3] [vector-effect:non-scaling-stroke]" />
    </svg>
  );
}

/** Photo agrandie. */
function PhotoDialog({ photo, onClose, closeLabel }: { photo: GroupPhoto | null; onClose: () => void; closeLabel: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (photo && !d.open) d.showModal();
    else if (!photo && d.open) d.close();
  }, [photo]);
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto max-h-[92vh] max-w-[min(1100px,94vw)] overflow-hidden rounded-site border-0 bg-noir p-0 backdrop:bg-noir/80"
    >
      {photo && (
        <figure className="m-0">
          <img src={photo.url} alt={photo.caption} className="block max-h-[82vh] w-auto max-w-full" />
          <figcaption className="flex items-center justify-between gap-4 px-4 py-3 text-creme">
            <span>{photo.caption}</span>
            <button type="button" className="btn btn-creme btn-sm" onClick={onClose}>
              {closeLabel}
            </button>
          </figcaption>
        </figure>
      )}
    </dialog>
  );
}

/* ------------------------------------------------------------------------------------------------------------------
 * Barre d'édition (membres du groupe et admins) — en français seulement, comme le reste de l'espace membre.
 * ---------------------------------------------------------------------------------------------------------------- */

type Panel = 'links' | 'about' | 'engage' | 'cover' | 'logo' | 'photos' | 'qr';

const PANELS: { key: Panel; label: string }[] = [
  { key: 'links', label: 'Réseaux sociaux' },
  { key: 'engage', label: 'Lien « Je m’engage »' },
  { key: 'about', label: 'Présentation' },
  { key: 'cover', label: 'Image d’en-tête' },
  { key: 'logo', label: 'Logo' },
  { key: 'photos', label: 'Photos' },
  { key: 'qr', label: 'QR code' },
];

/** Réseaux proposés (mêmes choix que dans l'admin Django). */
const NETWORK_CHOICES = [
  'instagram',
  'facebook',
  'telegram',
  'whatsapp',
  'bluesky',
  'x',
  'tiktok',
  'youtube',
  'twitch',
  'linktree',
];

function EditorBar({ group, onChange }: { group: ActionGroupDetail; onChange: (g: ActionGroupDetail) => void }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const close = () => setOpen(null);
  return (
    <div className="border-b-4 border-jaune bg-violet text-creme">
      <div className="site-container flex flex-wrap items-center justify-between gap-3 py-3">
        <span className="text-[14px] bold">Mode édition</span>
        <nav aria-label="Modifier la page du groupe" className="flex flex-wrap gap-2">
          {PANELS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-expanded={open === p.key}
              aria-controls="group-editor-panel"
              onClick={() => setOpen(open === p.key ? null : p.key)}
              className={`btn btn-sm ${open === p.key ? 'btn-creme' : 'btn-outline border-creme! text-creme! hover:bg-creme! hover:text-violet!'}`}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </div>
      {open && (
        <div id="group-editor-panel" className="bg-gris-clair text-noir">
          <div className="site-container py-5">
            <div className="rounded-site border border-gris bg-white p-4">
              {open === 'links' && <LinksEditor group={group} onSaved={onChange} onDone={close} />}
              {open === 'engage' && <EngageEditor group={group} onSaved={onChange} onDone={close} />}
              {open === 'about' && <AboutEditor group={group} onSaved={onChange} onDone={close} />}
              {open === 'photos' && <PhotosEditor group={group} onSaved={onChange} />}
              {open === 'cover' && <ImageEditor field="cover" group={group} onSaved={onChange} />}
              {open === 'logo' && <ImageEditor field="logo" group={group} onSaved={onChange} />}
              {open === 'qr' && <QrPanel group={group} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface EditorProps {
  group: ActionGroupDetail;
  onSaved: (g: ActionGroupDetail) => void;
  onDone: () => void;
}

/** Enregistrement commun : état « en cours », message d'erreur de l'API. */
function useSave(group: ActionGroupDetail, onSaved: (g: ActionGroupDetail) => void, onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (body: Parameters<typeof api.updateActionGroup>[1]) => {
    setBusy(true);
    setError('');
    try {
      onSaved(await api.updateActionGroup(group.id, body));
      onDone?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, save };
}

function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="alert alert-err m-0" role="alert">
      {error}
    </div>
  ) : null;
}

function LinksEditor({ group, onSaved, onDone }: EditorProps) {
  const [links, setLinks] = useState<ActionGroupLink[]>(group.links);
  const { busy, error, save } = useSave(group, onSaved, onDone);
  const update = (i: number, patch: Partial<ActionGroupLink>) =>
    setLinks((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, step: number) =>
    setLinks((l) => {
      const next = [...l];
      [next[i], next[i + step]] = [next[i + step], next[i]];
      return next;
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save({ links: links.filter((l) => l.url.trim()).map((l) => ({ ...l, url: l.url.trim() })) });
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div>
        <h2 className="m-0 text-[20px] text-violet">Réseaux sociaux du groupe</h2>
        <p className="m-0 text-[14px] text-texte">
          Affichés en haut de cette page et dans la bulle du groupe sur la carte. « Dans la liste » : aussi en icône dans la liste
          des groupes, à côté de la carte (gardez-y les principaux).
        </p>
      </div>
      {links.length === 0 && <p className="m-0 font-bold">Aucun réseau pour l'instant.</p>}
      <ul className="m-0 grid list-none gap-2 p-0">
        {links.map((l, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-gris-clair p-2">
            <label className="visually-hidden" htmlFor={`link-net-${i}`}>
              Réseau
            </label>
            <select
              id={`link-net-${i}`}
              value={l.network}
              onChange={(e) => update(i, { network: e.target.value })}
              className="w-[150px] py-1.5!"
            >
              {NETWORK_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {networkName(n)}
                </option>
              ))}
            </select>
            <label className="visually-hidden" htmlFor={`link-url-${i}`}>
              Adresse du compte
            </label>
            <input
              id={`link-url-${i}`}
              type="url"
              required
              placeholder="https://…"
              value={l.url}
              onChange={(e) => update(i, { url: e.target.value })}
              className="min-w-[200px] flex-1 py-1.5!"
            />
            <label className="inline-flex items-center gap-1.5 text-[14px]">
              <input type="checkbox" checked={l.show_in_list} onChange={(e) => update(i, { show_in_list: e.target.checked })} />
              Dans la liste
            </label>
            <span className="flex gap-1">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={i === links.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm text-rouge!"
                onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}
                aria-label={`Retirer ${networkName(l.network)}`}
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() =>
            setLinks((l) => [
              ...l,
              {
                network: NETWORK_CHOICES.find((n) => !l.some((x) => x.network === n)) ?? 'instagram',
                url: '',
                show_in_list: true,
              },
            ])
          }
        >
          + Ajouter un réseau
        </button>
        <span className="flex-1" />
        <button type="button" className="btn btn-outline btn-sm" onClick={onDone}>
          Annuler
        </button>
        <button type="submit" className="btn btn-sm" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      <ErrorBox error={error} />
    </form>
  );
}

function EngageEditor({ group, onSaved, onDone }: EditorProps) {
  const [url, setUrl] = useState(group.engage_url_is_default ? '' : (group.engage_url ?? ''));
  const { busy, error, save } = useSave(group, onSaved, onDone);
  const i18n = useI18n();
  const city = group.calendar_city ? i18n.city(group.calendar_city) : null;

  if (!city) {
    return (
      <div className="grid gap-2">
        <h2 className="m-0 text-[20px] text-violet">Lien « Je m’engage »</h2>
        <p className="m-0">
          Ce groupe n'est rattaché à aucune ville de l'agenda : demandez à un·e admin de lui en choisir une (admin → Groupes
          d'action → « ville de l'agenda »).
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ engage_url: url.trim() });
      }}
      className="grid gap-3"
    >
      <div>
        <h2 className="m-0 text-[20px] text-violet">Lien « Je m’engage » — {city}</h2>
        <p className="m-0 text-[14px] text-texte">
          Formulaire (Zetkin…) ouvert par le bouton « Je m’engage » de cette page, et sur la page « Je soutiens » quand une
          personne choisit <strong>{city}</strong>. Il est partagé par tous les groupes de {city}. Laissez vide pour utiliser le
          formulaire par défaut de la campagne.
        </p>
      </div>
      <div className="field m-0">
        <label htmlFor="engage-url">Adresse du formulaire</label>
        <input
          id="engage-url"
          type="url"
          placeholder={
            group.engage_url_is_default && group.engage_url
              ? `Par défaut : ${group.engage_url}`
              : 'https://app.zetkin.org/o/…/surveys/…'
          }
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={onDone}>
          Annuler
        </button>
        <button type="submit" className="btn btn-sm" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      <ErrorBox error={error} />
    </form>
  );
}

/** Longueur maximale de la présentation (comme côté serveur) : elle tient en quelques lignes dans l'en-tête. */
const DESCRIPTION_MAX = 300;

function AboutEditor({ group, onSaved, onDone }: EditorProps) {
  const [text, setText] = useState(group.description);
  const { busy, error, save } = useSave(group, onSaved, onDone);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ description: text });
      }}
      className="grid gap-3"
    >
      <div className="field m-0">
        <label htmlFor="group-about" className="text-[20px] text-violet">
          Présentation du groupe
        </label>
        <textarea
          id="group-about"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          placeholder="En deux ou trois phrases : qui vous êtes, ce que vous faites…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <span className={`text-[13px] ${text.length >= DESCRIPTION_MAX ? 'font-bold text-rouge' : 'text-texte'}`}>
          {text.length} / {DESCRIPTION_MAX} caractères · affichée en haut de la page, en français dans toutes les langues
        </span>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={onDone}>
          Annuler
        </button>
        <button type="submit" className="btn btn-sm" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      <ErrorBox error={error} />
    </form>
  );
}

function PhotosEditor({ group, onSaved }: { group: ActionGroupDetail; onSaved: (g: ActionGroupDetail) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!files.length) return;
    setBusy(true);
    setError('');
    const added: GroupPhoto[] = [];
    try {
      for (const file of files) added.push(await api.uploadGroupPhoto(group.id, file, caption.trim()));
      setFiles([]);
      setCaption('');
      if (input.current) input.current.value = '';
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      onSaved({ ...group, photos: [...added.reverse(), ...group.photos] });
      setBusy(false);
    }
  };

  const remove = async (photo: GroupPhoto) => {
    setBusy(true);
    setError('');
    try {
      await api.deleteGroupPhoto(group.id, photo.id);
      onSaved({ ...group, photos: group.photos.filter((p) => p.id !== photo.id) });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  };

  return (
    <div className="grid gap-4">
      <form onSubmit={upload} className="grid gap-3">
        <h2 className="m-0 text-[20px] text-violet">Photos du groupe</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="field m-0 min-w-[220px] flex-1">
            <label htmlFor="group-photo-files">Photos (JPEG, PNG… 10 Mo maximum chacune)</label>
            <input
              id="group-photo-files"
              ref={input}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles([...(e.target.files ?? [])])}
            />
          </div>
          <div className="field m-0 min-w-[220px] flex-1">
            <label htmlFor="group-photo-caption">Légende (facultative)</label>
            <input
              id="group-photo-caption"
              type="text"
              maxLength={200}
              placeholder="Ex. : stand devant le consulat, mars 2027"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-sm" disabled={busy || !files.length}>
            {busy ? 'Envoi…' : files.length > 1 ? `Ajouter ${files.length} photos` : 'Ajouter'}
          </button>
        </div>
        <p className="m-0 text-[13px] text-texte">
          Assurez-vous que les personnes reconnaissables sont d'accord pour apparaître sur le site.
        </p>
      </form>

      {group.photos.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-0">
          {group.photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-gris">
              <img src={p.url} alt={p.caption} className="block aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="grid gap-1 p-2 text-[13px]">
                {p.caption && (
                  <span className="truncate" title={p.caption}>
                    {p.caption}
                  </span>
                )}
                {confirmId === p.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-rouge">Supprimer ?</strong>
                    <button type="button" className="btn-link font-bold text-rouge" disabled={busy} onClick={() => remove(p)}>
                      Oui
                    </button>
                    <button type="button" className="btn-link font-bold" onClick={() => setConfirmId(null)}>
                      Non
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-link justify-self-start font-bold text-rouge no-underline!"
                    onClick={() => setConfirmId(p.id)}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ErrorBox error={error} />
    </div>
  );
}

/** Lien de la page et son QR code (logo du groupe sur le sticker). */
function QrPanel({ group }: { group: ActionGroupDetail }) {
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="m-0 text-[20px] text-violet">Lien et QR code de cette page</h2>
      </div>
      <QrLink
        langPicker="select"
        id={`group-${group.id}`}
        name={group.name}
        logo={group.logo}
        urlFor={(lang) => groupPageUrl(group.slug, lang)}
      />
      {group.visits && <VisitCounts visits={group.visits} />}
    </div>
  );
}

/** Visites de la page du groupe (hors membres du groupe), comme sur les trackers. */
function VisitCounts({ visits: v }: { visits: GroupVisits }) {
  const stats = [
    { label: 'visites au total', value: v.total },
    { label: '30 derniers jours', value: v.last_30_days },
    { label: '7 derniers jours', value: v.last_7_days },
  ];
  return (
    <div className="grid gap-2 border-t border-gris pt-3">
      <h3 className="m-0 text-[16px] text-violet">Visites de cette page</h3>
      <dl className="m-0 flex flex-wrap gap-3">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-[130px] flex-col-reverse rounded-lg bg-lavande px-4 py-2">
            <dt className="text-[13px] text-texte">{s.label}</dt>
            <dd className="m-0 font-titre text-[28px] leading-none text-violet">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-[13px] text-texte">
        Par langue : FR {v.by_lang.fr} · EN {v.by_lang.en} · DE {v.by_lang.de} — une visite par personne et par session, sans
        compter les membres du groupe.
      </p>
    </div>
  );
}

const IMAGE_TEXTS: Record<
  GroupImageField,
  { title: string; hint: string; name: string; add: string; replace: string; remove: string; none: string }
> = {
  cover: {
    title: 'Image d’en-tête',
    hint: 'Grande image en haut de la page, recadrée en bandeau : une photo en format paysage (1600 px de large ou plus) rend le mieux. Évitez d’y mettre du texte, il serait coupé sur téléphone.',
    name: 'Image d’en-tête actuelle',
    add: 'Ajouter une image d’en-tête',
    replace: 'Remplacer l’image',
    remove: 'Retirer l’image',
    none: 'Pas d’image',
  },
  logo: {
    title: 'Logo du groupe',
    hint: 'Affiché en haut de la page et sur les QR codes « sticker ». Un PNG carré à fond transparent rend le mieux.',
    name: 'Logo actuel',
    add: 'Ajouter un logo',
    replace: 'Remplacer le logo',
    remove: 'Retirer le logo',
    none: 'Pas de logo',
  },
};

/** Logo (page du groupe, stickers QR code) ou image d'en-tête du groupe. */
function ImageEditor({
  field,
  group,
  onSaved,
}: {
  field: GroupImageField;
  group: ActionGroupDetail;
  onSaved: (g: ActionGroupDetail) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const text = IMAGE_TEXTS[field];
  const current = group[field];
  const cover = field === 'cover';

  const run = async (action: () => Promise<Record<GroupImageField, string | null>>) => {
    setBusy(true);
    setError('');
    try {
      const data = await action();
      onSaved({ ...group, [field]: data[field] });
      if (input.current) input.current.value = '';
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="m-0 text-[20px] text-violet">{text.title}</h2>
        <p className="m-0 text-[14px] text-texte">{text.hint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={`grid shrink-0 place-items-center overflow-hidden rounded-lg bg-violet ${cover ? 'h-[96px] w-[256px]' : 'h-[96px] w-[96px] p-2'}`}
        >
          {current ? (
            <img
              src={current}
              alt={text.name}
              className={cover ? 'h-full w-full object-cover' : 'max-h-full max-w-full object-contain'}
            />
          ) : (
            <span className="text-center text-[12px] text-creme">{text.none}</span>
          )}
        </span>
        <div className="field m-0 min-w-[220px] flex-1">
          <label htmlFor={`group-${field}-file`}>{current ? text.replace : text.add} (10 Mo maximum)</label>
          <input
            id={`group-${field}-file`}
            ref={input}
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) run(() => api.uploadGroupImage(group.id, field, file));
            }}
          />
        </div>
        {current && (
          <button
            type="button"
            className="btn btn-outline btn-sm text-rouge!"
            disabled={busy}
            onClick={() => run(() => api.deleteGroupImage(group.id, field))}
          >
            {text.remove}
          </button>
        )}
      </div>
      {busy && <p className="loader m-0">Envoi…</p>}
      <ErrorBox error={error} />
    </div>
  );
}
