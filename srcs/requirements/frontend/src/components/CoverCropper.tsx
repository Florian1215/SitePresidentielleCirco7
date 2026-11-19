import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

/** Format des images de couverture : celui des cartes d'articles (16:9). */
export const COVER_ASPECT = 16 / 9;
/** Largeur de l'image envoyée (px) : nette sur grand écran, légère à charger. */
const OUTPUT_WIDTH = 1600;
/** En dessous de cette largeur (px), le cadre ne peut plus rétrécir : l'image serait floue. */
const MIN_WIDTH = 640;
/** En dessous de cette largeur (px), on prévient que l'image risque d'être floue en grand. */
const SHARP_WIDTH = 1000;

/** Cadre de recadrage, en pixels de l'image d'origine (hauteur = w / aspect). */
interface Crop {
  x: number;
  y: number;
  w: number;
}

type Corner = 'nw' | 'ne' | 'sw' | 'se';
type Drag = { mode: 'move' | Corner; startX: number; startY: number; start: Crop };

const CORNERS: { corner: Corner; className: string; label: string }[] = [
  { corner: 'nw', className: 'top-0 left-0 cursor-nwse-resize', label: 'haut gauche' },
  { corner: 'ne', className: 'top-0 right-0 cursor-nesw-resize', label: 'haut droit' },
  { corner: 'sw', className: 'bottom-0 left-0 cursor-nesw-resize', label: 'bas gauche' },
  { corner: 'se', className: 'right-0 bottom-0 cursor-nwse-resize', label: 'bas droit' },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Plus grand cadre au format, centré dans l'image. */
function initialCrop(nw: number, nh: number, aspect: number): Crop {
  const w = Math.min(nw, nh * aspect);
  return { x: (nw - w) / 2, y: (nh - w / aspect) / 2, w };
}

/**
 * Fenêtre de recadrage de l'image de couverture : un cadre au format 16:9 à déplacer (glisser)
 * et à agrandir ou réduire (coins, ou clavier : flèches pour déplacer, + / − pour la taille).
 * Renvoie l'image recadrée en JPEG.
 */
export function CoverCropper({
  src,
  name,
  aspect = COVER_ASPECT,
  onDone,
  onCancel,
}: {
  /** Adresse de l'image à recadrer (URL d'objet d'un fichier choisi, ou image déjà en ligne). */
  src: string;
  /** Nom du fichier d'origine (le fichier envoyé prend l'extension .jpg). */
  name: string;
  aspect?: number;
  onDone: (file: File) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  /** Échelle d'affichage : pixels à l'écran par pixel d'image. */
  const [scale, setScale] = useState(1);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  // L'échelle suit la taille affichée de l'image (redimensionnement de la fenêtre, rotation du téléphone)
  useEffect(() => {
    const el = img.current;
    if (!el || !natural) return;
    const update = () => setScale(el.clientWidth / natural.w || 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [natural]);

  const onLoad = () => {
    const el = img.current!;
    const n = { w: el.naturalWidth, h: el.naturalHeight };
    setNatural(n);
    setCrop(initialCrop(n.w, n.h, aspect));
  };

  const maxW = natural ? Math.min(natural.w, natural.h * aspect) : 0;
  /** Largeur minimale du cadre : 15 % de l'image, et assez de pixels pour rester net. */
  const minW = Math.min(maxW, Math.max(MIN_WIDTH, (natural?.w ?? 0) * 0.15));

  /** Garde le cadre dans l'image. */
  const fit = (c: Crop): Crop => {
    if (!natural) return c;
    const w = clamp(c.w, minW, maxW);
    return { w, x: clamp(c.x, 0, natural.w - w), y: clamp(c.y, 0, natural.h - w / aspect) };
  };

  const onPointerDown = (mode: Drag['mode']) => (e: PointerEvent<HTMLElement>) => {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || !natural) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const s = d.start;
    const sh = s.w / aspect;
    if (d.mode === 'move') {
      setCrop(fit({ ...s, x: s.x + dx, y: s.y + dy }));
      return;
    }
    // Redimensionnement depuis un coin : le coin opposé reste fixe, le format est conservé
    const east = d.mode === 'ne' || d.mode === 'se';
    const south = d.mode === 'sw' || d.mode === 'se';
    // On suit l'axe sur lequel la souris (ou le doigt) a le plus bougé
    const growX = east ? dx : -dx;
    const growY = (south ? dy : -dy) * aspect;
    const grow = Math.abs(growX) >= Math.abs(growY) ? growX : growY;
    const anchorX = east ? s.x : s.x + s.w;
    const anchorY = south ? s.y : s.y + sh;
    // Place disponible entre le coin fixe et les bords de l'image
    const roomW = Math.min(east ? natural.w - anchorX : anchorX, (south ? natural.h - anchorY : anchorY) * aspect);
    const w = clamp(s.w + grow, minW, Math.min(maxW, roomW));
    setCrop({ w, x: east ? anchorX : anchorX - w, y: south ? anchorY : anchorY - w / aspect });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  /** Clavier : flèches = déplacer (Maj : plus vite), + / − = agrandir / réduire autour du centre. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (!crop || !natural) return;
    const step = (e.shiftKey ? 0.1 : 0.02) * natural.w;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setCrop(fit({ ...crop, x: crop.x + dx, y: crop.y + dy }));
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault();
      const w = clamp(crop.w * (e.key === '-' ? 0.92 : 1.08), minW, maxW);
      const cx = crop.x + crop.w / 2;
      const cy = crop.y + crop.w / aspect / 2;
      setCrop(fit({ w, x: cx - w / 2, y: cy - w / aspect / 2 }));
    }
  };

  const confirm = () => {
    if (!crop || !img.current) return;
    setSaving(true);
    const width = Math.round(Math.min(OUTPUT_WIDTH, crop.w));
    const height = Math.round(width / aspect);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; // fond des images transparentes (PNG)
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    try {
      ctx.drawImage(img.current, crop.x, crop.y, crop.w, crop.w / aspect, 0, 0, width, height);
    } catch {
      setSaving(false);
      setError('Impossible de recadrer cette image : essayez-en une autre.');
      return;
    }
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (!blob) {
          setError('Impossible de recadrer cette image : essayez-en une autre.');
          return;
        }
        const base = name.replace(/\.[^.]+$/, '').slice(0, 80) || 'couverture';
        onDone(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.88,
    );
  };

  const box = crop && {
    left: crop.x * scale,
    top: crop.y * scale,
    width: crop.w * scale,
    height: (crop.w / aspect) * scale,
  };

  return (
    <dialog
      ref={dialog}
      className="m-auto w-[min(920px,calc(100vw-24px))] max-w-none rounded-site border-0 bg-white p-0 shadow-site backdrop:bg-noir/70"
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="stack p-[clamp(16px,3vw,28px)]">
        <h2 id="crop-title" className="m-0 text-[24px]">
          Recadrer l'image de couverture
        </h2>

        <div className="grid place-items-center rounded-lg bg-gris-clair p-2">
          <div className="relative max-w-full touch-none overflow-hidden select-none">
            <img
              ref={img}
              src={src}
              alt="Image à recadrer"
              onLoad={onLoad}
              onError={() => setError("Cette image n'a pas pu être ouverte.")}
              className="block max-h-[60vh] max-w-full"
              draggable={false}
            />
            {box && (
              <div
                role="slider"
                tabIndex={0}
                aria-label="Cadre de recadrage : flèches pour le déplacer, + et − pour changer sa taille"
                aria-valuetext={`${Math.round((crop!.w / natural!.w) * 100)} % de la largeur de l'image`}
                className="absolute cursor-move outline-2 outline-white shadow-[0_0_0_9999px_rgba(33,35,32,.6)] focus-visible:outline-4 focus-visible:outline-jaune"
                style={box}
                onPointerDown={onPointerDown('move')}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
              >
                {/* Repères des tiers */}
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_calc(33.33%-0.5px),rgba(255,255,255,.5)_calc(33.33%-0.5px),rgba(255,255,255,.5)_calc(33.33%+0.5px),transparent_calc(33.33%+0.5px),transparent_calc(66.66%-0.5px),rgba(255,255,255,.5)_calc(66.66%-0.5px),rgba(255,255,255,.5)_calc(66.66%+0.5px),transparent_calc(66.66%+0.5px)),linear-gradient(to_bottom,transparent_calc(33.33%-0.5px),rgba(255,255,255,.5)_calc(33.33%-0.5px),rgba(255,255,255,.5)_calc(33.33%+0.5px),transparent_calc(33.33%+0.5px),transparent_calc(66.66%-0.5px),rgba(255,255,255,.5)_calc(66.66%-0.5px),rgba(255,255,255,.5)_calc(66.66%+0.5px),transparent_calc(66.66%+0.5px))]" />
                {CORNERS.map((c) => (
                  <span
                    key={c.corner}
                    aria-hidden="true"
                    title={`Redimensionner (coin ${c.label})`}
                    className={`absolute grid h-9 w-9 touch-none place-items-center after:h-5 after:w-5 after:rounded-full after:border-[3px] after:border-violet after:bg-white after:shadow after:content-[''] ${c.className}`}
                    onPointerDown={onPointerDown(c.corner)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {crop && crop.w < SHARP_WIDTH && !error && (
          <p className="m-0 text-[14px] font-bold text-rouge-dark">
            {crop.w >= maxW
              ? 'Cette image est petite : elle risque de paraître floue en haut de l’article. Une image plus grande serait préférable.'
              : 'Cadre serré : l’image risque de paraître floue en grand. Agrandissez le cadre si possible.'}
          </p>
        )}

        {error && (
          <div className="alert alert-err m-0" role="alert">
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="btn" disabled={!crop || saving || !!error} onClick={confirm}>
            {saving ? 'Recadrage…' : 'Valider le cadrage'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
