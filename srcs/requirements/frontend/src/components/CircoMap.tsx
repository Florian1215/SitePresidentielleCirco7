import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { MAP_COUNTRIES, MAP_EXTENT, MAP_VIEWBOX, project } from '../data/europe-map';
import { COUNTRIES } from '../lib/campaign';
import { useI18n } from '../lib/i18n';

/** Point affiché sur la carte (groupe d'action, bureau de vote…). */
export interface MapPoint {
  id: number;
  name: string;
  /** Code ISO du pays. */
  country: string;
  latitude: number;
  longitude: number;
  /** Lien ouvert au clic sur le point (et dans la liste). */
  href: string;
}

/** Textes de la carte (déjà traduits ; {n} et {name} sont remplacés). */
export interface MapLabels {
  mapAria: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  registeredN: string;
  pointOne: string;
  pointMany: string;
  listAria: string;
  listEmpty: string;
  /** Texte lu par les lecteurs d'écran sur un point : « {name} — … ». */
  pointAria: string;
}

interface Props<T extends MapPoint> {
  points: T[];
  labels: MapLabels;
  /** Contenu de la bulle d'information d'un point. */
  renderTooltip: (point: T) => ReactNode;
  /** Bulle cliquable (liens à l'intérieur) : elle reste ouverte le temps d'y amener la souris. */
  interactiveTooltip?: boolean;
  /** Contenu d'un élément de la liste (par défaut, le nom). */
  renderItem?: (point: T) => ReactNode;
  /** Liens affichés à droite d'un élément de la liste (ex. réseaux sociaux), hors du lien principal. */
  renderItemExtra?: (point: T) => ReactNode;
  /** Titre posé sur la carte, en haut à gauche (au-dessus de la carte sur mobile). */
  title?: ReactNode;
  /** Encadré en bas du panneau. */
  panelFooter?: ReactNode;
  /** Préfixe des identifiants HTML (titre de la carte, listes par pays) : « groupes », « bureaux »… */
  idPrefix: string;
}

interface Pin<T> {
  point: T;
  x: number;
  y: number;
}

const [, , MAP_W, MAP_H] = MAP_VIEWBOX.split(' ').map(Number);

/** Partie visible de la carte (coordonnées du fond de carte). */
interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_ZOOM = 8;
/** Marge autour de la circonscription dans la vue d'ensemble. */
const FIT_MARGIN = 1.06;

/** Écarte légèrement les épingles trop proches à l'écran (plusieurs points dans la même ville). */
function spread<T>(pins: Pin<T>[], minDist: number, offset: number): Pin<T>[] {
  const clusters: Pin<T>[][] = [];
  for (const pin of pins) {
    const near = clusters.find((c) => Math.hypot(c[0].x - pin.x, c[0].y - pin.y) < minDist);
    if (near) near.push(pin);
    else clusters.push([pin]);
  }
  return clusters.flatMap((c) =>
    c.length === 1
      ? c
      : c.map((p, i) => {
          const angle = (2 * Math.PI * i) / c.length - Math.PI / 2;
          return { ...p, x: c[0].x + Math.cos(angle) * offset, y: c[0].y + Math.sin(angle) * offset };
        }),
  );
}

/** Bords de la zone de contenu (1200 px centrés), pour aligner boutons, légende et panneau posés sur la carte. */
const EDGE_LEFT = 'left-[max(24px,calc((100vw_-_var(--container-site))_/_2_+_var(--spacing-gutter)))]';
const EDGE_RIGHT = 'right-[max(24px,calc((100vw_-_var(--container-site))_/_2_+_var(--spacing-gutter)))]';

/** Pays : frontières toujours fines, quel que soit le zoom. */
const COUNTRY = 'stroke-1 [vector-effect:non-scaling-stroke]';

const ZOOM_BTN =
  'h-10 w-10 cursor-pointer border-0 bg-white font-texte leading-none font-bold text-violet not-first:border-t not-first:border-gris enabled:hover:bg-lavande disabled:cursor-default disabled:text-gris-moyen focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-jaune';

/**
 * Bulle d'un point, posée par-dessus la page (elle peut déborder de la carte sans être coupée).
 * « before » : zone invisible qui comble l'écart avec le point (bulle cliquable) ; « after » : la pointe,
 * placée en --arrow-x pour rester sous le point quand la bulle est décalée près d'un bord de l'écran.
 */
const TOOLTIP =
  "before:absolute before:inset-x-0 before:h-4 before:content-[''] fixed z-[60] flex max-w-[min(330px,calc(100vw-16px))] min-w-[180px] flex-col gap-0.5 rounded-[10px] bg-noir px-3.5 py-2.5 text-creme no-underline shadow-[0_10px_24px_rgba(0,0,0,0.25)] after:absolute after:left-(--arrow-x) after:h-3.5 after:w-3.5 after:-translate-x-1/2 after:rotate-45 after:bg-noir after:content-[''] max-[600px]:min-w-[150px] [&_em]:mt-1 [&_em]:text-[13px] [&_em]:font-bold [&_em]:text-jaune [&_em]:not-italic [&_span]:text-[13px] [&_span]:whitespace-pre-line [&_span]:opacity-80 [&_strong]:text-[15px] [&_strong]:leading-[1.25]";

/** Écart entre le point et la bulle (px), et marge minimale avec les bords de l'écran. */
const TIP_GAP = 16;
const TIP_MARGIN = 8;

/**
 * Bulle flottante : au-dessus du point s'il y a la place à l'écran (sous le menu collant), sinon en dessous ;
 * décalée horizontalement pour ne pas sortir de l'écran. Suit le défilement et le redimensionnement.
 */
function FloatingTooltip({
  box,
  leftPct,
  topPct,
  interactive,
  onEnter,
  onLeave,
  children,
}: {
  /** Zone de la carte dans laquelle le point est placé (left/top en % de cette zone). */
  box: HTMLElement;
  leftPct: number;
  topPct: number;
  interactive: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrow: number; above: boolean } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const r = box.getBoundingClientRect();
      const ax = r.left + (leftPct / 100) * r.width;
      const ay = r.top + (topPct / 100) * r.height;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      // Haut de la zone utilisable : sous le menu collant du site
      const header = document.querySelector('header.sticky');
      const minTop = Math.max(TIP_MARGIN, (header?.getBoundingClientRect().bottom ?? 0) + TIP_MARGIN);
      // Au-dessus du point dès que la bulle y tient ; sinon du côté où il y a le plus de place
      const roomAbove = ay - TIP_GAP - minTop;
      const roomBelow = window.innerHeight - TIP_MARGIN - (ay + TIP_GAP);
      const above = h <= roomAbove || (h > roomBelow && roomAbove >= roomBelow);
      const left = Math.min(Math.max(ax - w / 2, TIP_MARGIN), window.innerWidth - w - TIP_MARGIN);
      setPos({
        left,
        top: above ? ay - TIP_GAP - h : ay + TIP_GAP,
        arrow: Math.min(Math.max(ax - left, 14), w - 14),
        above,
      });
    };
    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [box, leftPct, topPct, children]);

  const above = pos?.above ?? true;
  return createPortal(
    <div
      ref={ref}
      className={`${TOOLTIP} ${interactive ? `pointer-events-auto ${above ? 'before:-bottom-4' : 'before:-top-4'}` : 'pointer-events-none'} ${above ? 'after:-bottom-[7px]' : 'after:-top-[7px]'}`}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden', // le temps de la mesurer
        ['--arrow-x' as string]: `${pos?.arrow ?? 0}px`,
      }}
      aria-hidden="true"
      onMouseEnter={interactive ? onEnter : undefined}
      onMouseLeave={interactive ? onLeave : undefined}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Carte des 16 pays de la circonscription avec des points cliquables, zoomable (boutons, Ctrl/⌘ + molette,
 * double-clic, pincement) et déplaçable, et une liste des points par pays posée dessus (dessous sur mobile).
 */
export function CircoMap<T extends MapPoint>({
  points,
  labels: t,
  renderTooltip,
  interactiveTooltip = false,
  renderItem,
  renderItemExtra,
  title,
  panelFooter,
  idPrefix,
}: Props<T>) {
  const i18n = useI18n();

  // ---------- Zoom et déplacement ----------
  const svgRef = useRef<SVGSVGElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  /** Taille affichée de la carte, en pixels (mise à jour au redimensionnement). */
  const [size, setSize] = useState({ w: MAP_W, h: MAP_H });
  /** Largeur du panneau posé sur la carte (0 quand il passe sous la carte, sur mobile). */
  const [panelPx, setPanelPx] = useState(0);
  /** Hauteur occupée en haut par le titre posé sur la carte (0 sans titre ou sur mobile). */
  const titleRef = useRef<HTMLDivElement>(null);
  /** Zone de la carte (sert à placer la bulle d'un point). */
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const [titlePx, setTitlePx] = useState(0);
  /** Vue choisie par l'utilisateur (zoom, déplacement) ; null = vue d'ensemble. */
  const [custom, setCustom] = useState<View | null>(null);

  /**
   * Vue d'ensemble : toute la circonscription, centrée dans la partie de la carte que le panneau
   * ne recouvre pas. Sa forme suit celle du cadre (large sur ordinateur, plus haute sur mobile).
   */
  const fullView = useMemo<View>(() => {
    const { w: pxW, h: pxH } = size;
    // Zone libre : à gauche du panneau et sous le titre
    const usableW = Math.max(1, pxW - panelPx);
    const usableH = Math.max(1, pxH - titlePx);
    const E = MAP_EXTENT;
    const cx = usableW / 2;
    const cy = titlePx + usableH / 2;
    // Assez petit pour que la circonscription tienne dans la zone libre…
    const fitUnit = Math.max((MAP_W * FIT_MARGIN) / usableW, (MAP_H * FIT_MARGIN) / usableH);
    // …sans dézoomer au-delà du fond de carte (sinon ses bords apparaissent sur les grands écrans)
    const maxUnit = Math.min(
      (MAP_W / 2 - E.x) / cx,
      (E.x + E.w - MAP_W / 2) / (pxW - cx),
      (MAP_H / 2 - E.y) / cy,
      (E.y + E.h - MAP_H / 2) / (pxH - cy),
    );
    const unit = Math.min(fitUnit, maxUnit);
    return {
      x: MAP_W / 2 - cx * unit,
      y: MAP_H / 2 - cy * unit,
      w: pxW * unit,
      h: pxH * unit,
    };
  }, [size, panelPx, titlePx]);

  const view = custom ?? fullView;
  const zoom = fullView.w / view.w;
  /** Combien d'unités de carte représente un pixel à l'écran. */
  const unit = view.w / size.w;
  /** Rayon des points en pixels : un peu plus gros sur petit écran, pour le doigt. */
  const pinPx = size.w < 600 ? 9 : 7;
  const dotR = pinPx * unit;
  const haloR = pinPx * 2 * unit;

  /** Borne la vue : zoom entre ×1 et ×MAX_ZOOM, et pas au-delà de la zone couverte par le fond de carte. */
  const clamp = useCallback(
    (v: View): View => {
      const full = fullView;
      const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, v.w));
      const h = (w * full.h) / full.w;
      const E = MAP_EXTENT;
      const fit = (pos: number, len: number, start: number, extent: number) =>
        len >= extent ? start + (extent - len) / 2 : Math.min(start + extent - len, Math.max(start, pos));
      return { w, h, x: fit(v.x, w, E.x, E.w), y: fit(v.y, h, E.y, E.h) };
    },
    [fullView],
  );

  // Valeurs courantes pour les gestionnaires d'événements (pointeurs, redimensionnement)
  const live = useRef({ view, fullView, custom, zoom, clamp });
  live.current = { view, fullView, custom, zoom, clamp };

  useEffect(() => {
    const svg = svgRef.current!;
    const measure = () => {
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const panel = panelRef.current;
      const overlaid = panel && getComputedStyle(panel).position === 'absolute';
      setPanelPx(overlaid ? panel.offsetWidth + 32 : 0);
      const title = titleRef.current;
      const titleOver = title && getComputedStyle(title).position === 'absolute';
      setTitlePx(titleOver ? title.offsetTop + title.offsetHeight + 8 : 0);
      setSize({ w: r.width, h: r.height });
      // Vue zoomée : on garde le centre et le niveau de zoom, avec la nouvelle forme du cadre
      const v = live.current.custom;
      if (v) {
        const h = (v.w * r.height) / r.width;
        setCustom(live.current.clamp({ w: v.w, h, x: v.x, y: v.y + (v.h - h) / 2 }));
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    measure();
    return () => observer.disconnect();
  }, []);

  /** Convertit une position à l'écran en coordonnées de carte. */
  const toMap = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = live.current.view;
    return { x: v.x + ((clientX - r.left) / r.width) * v.w, y: v.y + ((clientY - r.top) / r.height) * v.h };
  };

  /** Zoom (factor > 1 : rapprocher) en gardant le point (cx, cy) fixe à l'écran. */
  const zoomAt = (factor: number, cx: number, cy: number) => {
    const { view: v, fullView: full, clamp: cl } = live.current;
    // Le facteur est d'abord borné (zoom entre ×1 et ×MAX_ZOOM) pour que le point visé reste sous le curseur
    const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, v.w / factor));
    if (w >= full.w - 0.5) {
      setCustom(null); // retour à la vue d'ensemble
      live.current.custom = null;
      live.current.view = full;
      return;
    }
    const f = v.w / w;
    const next = cl({ w, h: v.h / f, x: cx - (cx - v.x) / f, y: cy - (cy - v.y) / f });
    setCustom(next);
    live.current.custom = next;
    live.current.view = next;
  };

  const zoomBy = (factor: number) => {
    const v = live.current.view;
    zoomAt(factor, v.x + v.w / 2, v.y + v.h / 2);
  };

  // Molette seule : la page défile normalement. Ctrl/⌘ + molette (ou pincement du pavé tactile) : zoom.
  // Écouteur natif non passif, pour pouvoir empêcher le zoom de la page.
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: globalThis.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const p = toMap(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.01), p.x, p.y);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const gesture = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    dragStart: null as { x: number; y: number; view: View } | null,
    pinchDist: 0,
    moved: 0,
  });

  const onDblClick = (e: MouseEvent) => {
    e.preventDefault();
    const p = toMap(e.clientX, e.clientY);
    zoomAt(2, p.x, p.y);
  };

  const onPointerDown = (e: PointerEvent) => {
    const g = gesture.current;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    g.moved = 0;
    if (g.pointers.size === 1) {
      g.dragStart = { x: e.clientX, y: e.clientY, view: live.current.view };
    } else if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      g.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      g.dragStart = null;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (g.pointers.size === 2) {
      const [a, b] = [...g.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.pinchDist) {
        const mid = toMap((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(dist / g.pinchDist, mid.x, mid.y);
      }
      g.pinchDist = dist;
      g.moved += 10;
    } else if (g.dragStart && live.current.zoom > 1) {
      const r = svgRef.current!.getBoundingClientRect();
      const s = g.dragStart;
      const dx = ((e.clientX - s.x) / r.width) * s.view.w;
      const dy = ((e.clientY - s.y) / r.height) * s.view.h;
      g.moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      const next = live.current.clamp({ ...s.view, x: s.view.x - dx, y: s.view.y - dy });
      setCustom(next);
      live.current.view = next;
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    const g = gesture.current;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size < 2) g.pinchDist = 0;
    if (g.pointers.size === 0) g.dragStart = null;
  };

  /** Après un glisser, le relâchement sur un point ne doit pas ouvrir le lien. */
  const onClick = (e: MouseEvent) => {
    if (gesture.current.moved > 5) {
      e.preventDefault();
      gesture.current.moved = 0;
    }
  };

  // ---------- Points et survol ----------
  const pins = useMemo(
    () =>
      spread(
        points.map((point) => {
          const [x, y] = project(point.longitude, point.latitude);
          return { point, x, y };
        }),
        pinPx * 2.2 * unit,
        pinPx * 1.4 * unit,
      ),
    [points, pinPx, unit],
  );

  /** Point survolé (identifiant) et pays survolé. */
  const [activeId, setActiveId] = useState<number | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const active = pins.find((p) => p.point.id === activeId) ?? null;

  /** Fermeture différée de la bulle cliquable (le temps d'y amener la souris). */
  const closeTimer = useRef(0);
  const keepOpen = () => clearTimeout(closeTimer.current);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const enterPin = (pin: Pin<T>) => {
    keepOpen();
    setActiveId(pin.point.id);
    setHoveredCountry(pin.point.country);
  };
  const leavePin = (pin: Pin<T>) => {
    const close = () => {
      setActiveId((id) => (id === pin.point.id ? null : id));
      setHoveredCountry((c) => (c === pin.point.country ? null : c));
    };
    keepOpen();
    if (interactiveTooltip) closeTimer.current = window.setTimeout(close, 300);
    else close();
  };
  const leaveCountry = (code: string) => setHoveredCountry((c) => (c === code ? null : c));

  /** Points classés par pays, dans l'ordre de COUNTRIES (du plus peuplé au moins peuplé). */
  const byCountry = useMemo(
    () =>
      COUNTRIES.map((country) => ({ country, points: points.filter((g) => g.country === country.code) })).filter(
        (entry) => entry.points.length,
      ),
    [points],
  );

  /** Pays dont la liste est dépliée dans le panneau (tous repliés au départ). */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleCountry = (code: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const countByCountry = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of points) counts[g.country] = (counts[g.country] ?? 0) + 1;
    return counts;
  }, [points]);

  const hovered = hoveredCountry ? (COUNTRIES.find((c) => c.code === hoveredCountry) ?? null) : null;

  /** Position de la bulle, en % de la zone visible ; null si le point est hors champ. */
  const tooltipPos = (() => {
    if (!active) return null;
    const left = ((active.x - view.x) / view.w) * 100;
    const top = ((active.y - view.y) / view.h) * 100;
    return left < 0 || left > 100 || top < 0 || top > 100 ? null : { left, top };
  })();

  return (
    <div className="relative max-[960px]:pb-8">
      {title && (
        <div
          ref={titleRef}
          className={`absolute top-6 z-2 max-w-[min(560px,calc(100%-440px))] rounded-site bg-[rgba(255,252,244,0.94)] px-5 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.12)] max-[960px]:static max-[960px]:mx-gutter max-[960px]:mb-4 max-[960px]:max-w-none max-[960px]:bg-transparent max-[960px]:p-0 max-[960px]:shadow-none ${EDGE_LEFT}`}
        >
          {title}
        </div>
      )}
      <div
        ref={mapBoxRef}
        className={`relative overflow-hidden bg-[#e6eef8] max-[960px]:h-[400px] ${title ? 'h-[clamp(600px,90vh,900px)]' : 'h-[clamp(520px,78vh,820px)]'}`}
      >
        <svg
          ref={svgRef}
          className={`block h-full w-full select-none ${zoom > 1 ? 'cursor-grab touch-none active:cursor-grabbing' : 'touch-pan-y'}`}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          role="img"
          aria-labelledby={`${idPrefix}-map-title`}
          onDoubleClick={onDblClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={onClick}
        >
          <title id={`${idPrefix}-map-title`}>{i18n.f(t.mapAria, { n: COUNTRIES.length })}</title>
          {MAP_COUNTRIES.map((country, idx) => {
            const code = country.code;
            return code ? (
              <path
                key={idx}
                className={`${COUNTRY} stroke-[rgba(255,252,244,0.7)] transition-[fill] duration-150 ${hoveredCountry === code ? 'fill-violet-vif' : 'fill-violet'}`}
                d={country.d}
                onMouseEnter={() => setHoveredCountry(code)}
                onMouseLeave={() => leaveCountry(code)}
              >
                <title>{i18n.country(code)}</title>
              </path>
            ) : (
              <path key={idx} className={`${COUNTRY} fill-[#f1ece0] stroke-white`} d={country.d} />
            );
          })}
          {pins.map((pin) => (
            <a
              key={pin.point.id}
              className="group cursor-pointer outline-none"
              href={pin.point.href}
              target="_blank"
              rel="noopener"
              aria-label={i18n.f(t.pointAria, { name: pin.point.name })}
              onMouseEnter={() => enterPin(pin)}
              onMouseLeave={() => leavePin(pin)}
              onFocus={() => enterPin(pin)}
              onBlur={() => leavePin(pin)}
            >
              {/* Le halo ne doit pas masquer un point voisin */}
              <circle
                className={`pointer-events-none fill-jaune transition-opacity duration-150 group-hover:opacity-55 group-focus-visible:opacity-55 ${activeId === pin.point.id ? 'opacity-55' : 'opacity-0'}`}
                cx={pin.x}
                cy={pin.y}
                r={haloR}
              />
              <circle
                className={`stroke-[2.5] transition-[fill] duration-150 [vector-effect:non-scaling-stroke] group-hover:fill-jaune group-hover:stroke-noir group-focus-visible:fill-jaune group-focus-visible:stroke-noir ${activeId === pin.point.id ? 'fill-jaune stroke-noir' : 'fill-rouge stroke-white'}`}
                cx={pin.x}
                cy={pin.y}
                r={dotR}
              />
            </a>
          ))}
        </svg>

        {active && tooltipPos && mapBoxRef.current && (
          <FloatingTooltip
            box={mapBoxRef.current}
            leftPct={tooltipPos.left}
            topPct={tooltipPos.top}
            interactive={interactiveTooltip}
            onEnter={keepOpen}
            onLeave={() => leavePin(active)}
          >
            {renderTooltip(active.point)}
          </FloatingTooltip>
        )}

        <div
          className={`absolute flex flex-col overflow-hidden rounded-[10px] shadow-[0_4px_14px_rgba(0,0,0,0.15)] max-[960px]:top-4 max-[960px]:left-4 ${title ? 'top-[150px]' : 'top-6'} ${EDGE_LEFT}`}
        >
          <button
            type="button"
            className={`${ZOOM_BTN} text-[22px]`}
            onClick={() => zoomBy(1.6)}
            disabled={zoom >= 7.9}
            aria-label={t.zoomIn}
          >
            +
          </button>
          <button
            type="button"
            className={`${ZOOM_BTN} text-[22px]`}
            onClick={() => zoomBy(1 / 1.6)}
            disabled={zoom <= 1}
            aria-label={t.zoomOut}
          >
            −
          </button>
          <button
            type="button"
            className={`${ZOOM_BTN} text-[18px]`}
            onClick={() => setCustom(null)}
            disabled={zoom <= 1}
            aria-label={t.resetZoom}
            title={t.resetZoom}
          >
            ⤢
          </button>
        </div>

        {/* Au survol d'un pays : son nom, ses inscrit·es et son nombre de points */}
        {hovered && (
          <div
            className={`absolute bottom-6 flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-lg bg-[rgba(255,252,244,0.95)] px-3 py-2 text-[13px] max-[600px]:right-0 max-[600px]:bottom-0 max-[600px]:left-0 max-[600px]:rounded-none [&_strong]:font-titre [&_strong]:text-[18px] [&_strong]:text-violet [&_strong]:uppercase ${EDGE_LEFT}`}
          >
            <>
              <strong>{i18n.country(hovered.code)}</strong>
              <span>
                {hovered.registered ? <>{i18n.f(t.registeredN, { n: i18n.number(hovered.registered) })} · </> : null}
                {(() => {
                  const n = countByCountry[hovered.code] || 0;
                  return i18n.f(n > 1 ? t.pointMany : t.pointOne, { n });
                })()}
              </span>
            </>
          </div>
        )}
      </div>

      {/* Panneau de la liste : posé sur la carte à droite ; sous la carte sur petit écran */}
      <aside
        className={`absolute top-6 z-3 max-h-[calc(100%-48px)] w-[340px] overflow-y-auto rounded-2xl bg-white px-[22px] py-5 shadow-[0_16px_40px_rgba(33,35,32,0.18)] max-[960px]:static max-[960px]:mx-gutter max-[960px]:mt-4 max-[960px]:max-h-none max-[960px]:w-auto ${EDGE_RIGHT}`}
        aria-label={t.listAria}
        ref={panelRef}
      >
        {byCountry.length ? (
          byCountry.map((entry) => {
            const code = entry.country.code;
            const open = expanded.has(code);
            const listId = `${idPrefix}-${code}`;
            return (
              <div key={code} className="not-first:mt-1">
                <h3 className="m-0 text-[22px]">
                  <button
                    type="button"
                    className="-mx-2 flex w-[calc(100%+16px)] cursor-pointer items-center gap-2.5 rounded-t-lg border-0 border-b-2 border-gris bg-transparent px-2 py-2.5 text-left [font:inherit] text-violet hover:bg-lavande focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-jaune"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => toggleCountry(code)}
                    onMouseEnter={() => setHoveredCountry(code)}
                    onMouseLeave={() => setHoveredCountry(null)}
                  >
                    <span className="flex-1">{i18n.country(code)}</span>
                    <span className="min-w-[26px] rounded-full bg-rose px-2 py-0.5 text-center font-texte text-[13px] font-bold text-rouge">
                      {entry.points.length}
                    </span>
                    <svg
                      className={`h-[18px] w-[18px] fill-none stroke-current stroke-[2.5] transition-transform duration-200 [stroke-linecap:round] [stroke-linejoin:round] ${open ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </h3>
                <ul id={listId} hidden={!open} className={`m-0 list-none gap-0.5 px-0 pt-1.5 pb-2.5 ${open ? 'grid' : 'hidden'}`}>
                  {entry.points.map((g) => (
                    <li key={g.id} className="flex items-center gap-1">
                      <a
                        href={g.href}
                        target="_blank"
                        rel="noopener"
                        className={`-mx-2 block min-w-0 flex-1 rounded-md px-2 py-[5px] text-[15px] no-underline hover:bg-lavande hover:text-violet ${activeId === g.id ? 'bg-lavande text-violet' : 'text-noir'}`}
                        onMouseEnter={() => {
                          setActiveId(g.id);
                          setHoveredCountry(g.country);
                        }}
                        onMouseLeave={() => {
                          setActiveId(null);
                          setHoveredCountry(null);
                        }}
                      >
                        {renderItem ? renderItem(g) : g.name}
                      </a>
                      {renderItemExtra?.(g)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        ) : (
          <p className="muted">{t.listEmpty}</p>
        )}
        {panelFooter && <div className="mt-5 rounded-site bg-rose p-4 [&_p]:mb-2.5 [&_p]:text-[14px]">{panelFooter}</div>}
      </aside>
    </div>
  );
}
