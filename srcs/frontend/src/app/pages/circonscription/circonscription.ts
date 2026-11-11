import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { CAMPAIGN, COUNTRIES } from '../../core/campaign.config';
import { I18n } from '../../core/i18n';
import { ActionGroup } from '../../core/models';
import { Photo } from '../../shared/photo';
import { MAP_COUNTRIES, MAP_EXTENT, MAP_VIEWBOX, project } from './europe-map';

interface Pin {
  group: ActionGroup;
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

/** Écarte légèrement les épingles trop proches à l'écran (plusieurs groupes dans la même ville). */
function spread(pins: Pin[], minDist: number, offset: number): Pin[] {
  const clusters: Pin[][] = [];
  for (const pin of pins) {
    const near = clusters.find((c) => Math.hypot(c[0].x - pin.x, c[0].y - pin.y) < minDist);
    near ? near.push(pin) : clusters.push([pin]);
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

@Component({
  selector: 'app-circonscription',
  imports: [Photo],
  templateUrl: './circonscription.html',
  styleUrl: './circonscription.scss',
})
export class Circonscription {
  private api = inject(ApiService);

  protected c = CAMPAIGN;
  protected countries = COUNTRIES;
  protected i18n = inject(I18n);
  protected mapViewBox = MAP_VIEWBOX;
  protected mapCountries = MAP_COUNTRIES;
  protected total = COUNTRIES.reduce((sum, p) => sum + (p.registered ?? 0), 0);

  protected groups = toSignal(this.api.actionGroups().pipe(catchError(() => of<ActionGroup[]>([]))), {
    initialValue: [],
  });

  // ---------- Zoom et déplacement ----------

  private svgRef = viewChild.required<ElementRef<SVGSVGElement>>('mapSvg');
  private panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  /** Taille affichée de la carte, en pixels (mise à jour au redimensionnement). */
  private size = signal({ w: MAP_W, h: MAP_H });
  /** Largeur du panneau posé sur la carte (0 quand il passe sous la carte, sur mobile). */
  private panelPx = signal(0);

  /**
   * Vue d'ensemble : toute la circonscription, centrée dans la partie de la carte que le panneau
   * ne recouvre pas. Sa forme suit celle du cadre (large sur ordinateur, plus haute sur mobile).
   */
  protected fullView = computed<View>(() => {
    const { w: pxW, h: pxH } = this.size();
    const usable = Math.max(1, pxW - this.panelPx());
    const h = usable / pxH > MAP_W / MAP_H ? MAP_H * FIT_MARGIN : (MAP_W * FIT_MARGIN * pxH) / usable;
    const w = (h * pxW) / pxH;
    const unit = w / pxW;
    return { x: MAP_W / 2 - (usable / 2) * unit, y: MAP_H / 2 - h / 2, w, h };
  });

  /** Vue choisie par l'utilisateur (zoom, déplacement) ; null = vue d'ensemble. */
  private custom = signal<View | null>(null);
  protected view = computed(() => this.custom() ?? this.fullView());
  protected viewBox = computed(() => {
    const v = this.view();
    return `${v.x} ${v.y} ${v.w} ${v.h}`;
  });
  protected zoom = computed(() => this.fullView().w / this.view().w);
  /** Combien d'unités de carte représente un pixel à l'écran. */
  private unit = computed(() => this.view().w / this.size().w);
  /** Rayon des points en pixels : un peu plus gros sur petit écran, pour le doigt. */
  private pinPx = computed(() => (this.size().w < 600 ? 9 : 7));
  protected dotR = computed(() => this.pinPx() * this.unit());
  protected haloR = computed(() => this.pinPx() * 2 * this.unit());

  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; view: View } | null = null;
  private pinchDist = 0;
  private moved = 0;
  private destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const svg = this.svgRef().nativeElement;
      const measure = () => {
        const r = svg.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const panel = this.panelRef()?.nativeElement;
        const overlaid = panel && getComputedStyle(panel).position === 'absolute';
        this.panelPx.set(overlaid ? panel.offsetWidth + 32 : 0);
        this.size.set({ w: r.width, h: r.height });
        // Vue zoomée : on garde le centre et le niveau de zoom, avec la nouvelle forme du cadre
        const v = this.custom();
        if (v) {
          const h = (v.w * r.height) / r.width;
          this.custom.set(this.clamp({ w: v.w, h, x: v.x, y: v.y + (v.h - h) / 2 }));
        }
      };
      const observer = new ResizeObserver(measure);
      observer.observe(svg);
      measure();
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Borne la vue : zoom entre ×1 et ×MAX_ZOOM, et pas au-delà de la zone couverte par le fond de carte. */
  private clamp(v: View): View {
    const full = this.fullView();
    const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, v.w));
    const h = (w * full.h) / full.w;
    const E = MAP_EXTENT;
    const fit = (pos: number, len: number, start: number, extent: number) =>
      len >= extent ? start + (extent - len) / 2 : Math.min(start + extent - len, Math.max(start, pos));
    return { w, h, x: fit(v.x, w, E.x, E.w), y: fit(v.y, h, E.y, E.h) };
  }

  /** Convertit une position à l'écran en coordonnées de carte. */
  private toMap(clientX: number, clientY: number) {
    const r = this.svgRef().nativeElement.getBoundingClientRect();
    const v = this.view();
    return { x: v.x + ((clientX - r.left) / r.width) * v.w, y: v.y + ((clientY - r.top) / r.height) * v.h };
  }

  /** Zoom (factor > 1 : rapprocher) en gardant le point (cx, cy) fixe à l'écran. */
  private zoomAt(factor: number, cx: number, cy: number) {
    const v = this.view();
    const full = this.fullView();
    // Le facteur est d'abord borné (zoom entre ×1 et ×MAX_ZOOM) pour que le point visé reste sous le curseur
    const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, v.w / factor));
    if (w >= full.w - 0.5) {
      this.custom.set(null); // retour à la vue d'ensemble
      return;
    }
    const f = v.w / w;
    this.custom.set(this.clamp({ w, h: v.h / f, x: cx - (cx - v.x) / f, y: cy - (cy - v.y) / f }));
  }

  protected zoomBy(factor: number) {
    const v = this.view();
    this.zoomAt(factor, v.x + v.w / 2, v.y + v.h / 2);
  }

  protected resetView() {
    this.custom.set(null);
  }

  protected onWheel(e: WheelEvent) {
    // Molette seule : la page défile normalement. Ctrl/⌘ + molette (ou pincement du pavé tactile) : zoom.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const p = this.toMap(e.clientX, e.clientY);
    this.zoomAt(Math.exp(-e.deltaY * 0.01), p.x, p.y);
  }

  protected onDblClick(e: MouseEvent) {
    e.preventDefault();
    const p = this.toMap(e.clientX, e.clientY);
    this.zoomAt(2, p.x, p.y);
  }

  protected onPointerDown(e: PointerEvent) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = 0;
    if (this.pointers.size === 1) {
      this.dragStart = { x: e.clientX, y: e.clientY, view: this.view() };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.dragStart = null;
    }
  }

  protected onPointerMove(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist) {
        const mid = this.toMap((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.zoomAt(dist / this.pinchDist, mid.x, mid.y);
      }
      this.pinchDist = dist;
      this.moved += 10;
    } else if (this.dragStart && this.zoom() > 1) {
      const r = this.svgRef().nativeElement.getBoundingClientRect();
      const s = this.dragStart;
      const dx = ((e.clientX - s.x) / r.width) * s.view.w;
      const dy = ((e.clientY - s.y) / r.height) * s.view.h;
      this.moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
      this.custom.set(this.clamp({ ...s.view, x: s.view.x - dx, y: s.view.y - dy }));
    }
  }

  protected onPointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.pointers.size === 0) this.dragStart = null;
  }

  /** Après un glisser, le relâchement sur un point ne doit pas ouvrir le lien. */
  protected onClick(e: MouseEvent) {
    if (this.moved > 5) {
      e.preventDefault();
      this.moved = 0;
    }
  }

  // ---------- Points et survol ----------

  protected pins = computed(() =>
    spread(
      this.groups().map((group) => {
        const [x, y] = project(group.longitude, group.latitude);
        return { group, x, y };
      }),
      this.pinPx() * 2.2 * this.unit(),
      this.pinPx() * 1.4 * this.unit(),
    ),
  );

  /** Groupe survolé (identifiant) et pays survolé. */
  protected activeId = signal<number | null>(null);
  protected hoveredCountry = signal<string | null>(null);

  protected active = computed(() => this.pins().find((p) => p.group.id === this.activeId()) ?? null);

  protected enterPin(pin: Pin) {
    this.activeId.set(pin.group.id);
    this.hoveredCountry.set(pin.group.country);
  }

  protected leavePin(pin: Pin) {
    if (this.activeId() === pin.group.id) this.activeId.set(null);
    if (this.hoveredCountry() === pin.group.country) this.hoveredCountry.set(null);
  }

  protected leaveCountry(code: string) {
    if (this.hoveredCountry() === code) this.hoveredCountry.set(null);
  }

  /** Groupes classés par pays, dans l'ordre de COUNTRIES (du plus peuplé au moins peuplé). */
  protected groupsByCountry = computed(() =>
    COUNTRIES.map((country) => ({
      country,
      groups: this.groups().filter((g) => g.country === country.code),
    })).filter((entry) => entry.groups.length),
  );

  /** Pays dont la liste de groupes est dépliée dans le panneau (tous repliés au départ). */
  protected expanded = signal<Set<string>>(new Set());

  protected toggleCountry(code: string) {
    this.expanded.update((s) => {
      const next = new Set(s);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  protected countByCountry = computed(() => {
    const counts: Record<string, number> = {};
    for (const g of this.groups()) counts[g.country] = (counts[g.country] ?? 0) + 1;
    return counts;
  });

  protected hovered = computed(() => {
    const code = this.hoveredCountry();
    return code ? COUNTRIES.find((c) => c.code === code) ?? null : null;
  });

  /** Position de la bulle, en % de la zone visible ; null si le point est hors champ. */
  protected tooltipPos = computed(() => {
    const pin = this.active();
    if (!pin) return null;
    const v = this.view();
    const left = ((pin.x - v.x) / v.w) * 100;
    const top = ((pin.y - v.y) / v.h) * 100;
    return left < 0 || left > 100 || top < 0 || top > 100 ? null : { left, top };
  });
}
