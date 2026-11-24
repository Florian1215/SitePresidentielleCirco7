/** Nom de fichier sans accents ni caractères spéciaux. */
export const fileSlug = (s: string, fallback = 'qr') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback;

/**
 * QR code :
 *   - classic : couleur du QR code et couleur du fond au choix (fond `null` : transparent, à poser sur un visuel) ;
 *   - sticker : fond violet du site, logo en haut, QR code blanc en bas.
 */
export type QrOptions = { style: 'classic'; fg: string; bg: string | null } | { style: 'sticker'; logo?: string | null };
export type QrStyle = QrOptions['style'];

/** Logo du sticker quand il n'y a pas de logo de groupe d'action. */
export const DEFAULT_QR_LOGO = '/brand/circo7-logo-transparent.png';

export const VIOLET = '#4c0297';
/** Marge autour du QR code, en modules (la norme en demande 4 ; 2 suffisent aux lecteurs actuels). */
const QUIET = 2;

interface Matrix {
  size: number;
  get(row: number, col: number): number | boolean;
}

async function matrixFor(url: string): Promise<Matrix> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.create(url, { errorCorrectionLevel: 'M' }).modules as unknown as Matrix;
}

/** Dessine les modules foncés du QR code dans le carré (x, y, side). */
function drawModules(ctx: CanvasRenderingContext2D, m: Matrix, x: number, y: number, side: number, color: string) {
  const cell = side / m.size;
  ctx.fillStyle = color;
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.get(r, c)) continue;
      // Bords arrondis au pixel : pas de fines lignes entre deux modules voisins
      const x0 = Math.round(x + c * cell);
      const y0 = Math.round(y + r * cell);
      ctx.fillRect(x0, y0, Math.round(x + (c + 1) * cell) - x0, Math.round(y + (r + 1) * cell) - y0);
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  return [el, el.getContext('2d')!] as const;
}

/** QR code du lien, dans le style demandé (sticker : logo Circo7 par défaut). */
export async function renderQr(url: string, opts: QrOptions): Promise<HTMLCanvasElement> {
  const m = await matrixFor(url);

  if (opts.style === 'classic') {
    const cell = Math.floor(1024 / (m.size + QUIET * 2));
    const side = cell * (m.size + QUIET * 2);
    const [el, ctx] = canvas(side, side);
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, side, side);
    }
    drawModules(ctx, m, cell * QUIET, cell * QUIET, cell * m.size, opts.fg);
    return el;
  }
  const logo = opts.logo;

  // Sticker : carte violette aux coins arrondis, logo en haut, QR code blanc en bas
  const W = 1000;
  const PAD = 110;
  const GAP = 90;
  const QR = W - PAD * 2;
  /** Zone du logo : un carré de la taille du QR code. */
  const LOGO = QR;
  const H = PAD + LOGO + GAP + QR + PAD;
  const [el, ctx] = canvas(W, H);
  ctx.fillStyle = VIOLET;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 64);
  ctx.fill();

  let img: HTMLImageElement;
  try {
    img = await loadImage(logo || DEFAULT_QR_LOGO);
  } catch {
    img = await loadImage(DEFAULT_QR_LOGO);
  }
  // Logo entier, centré dans sa zone (sans le déformer)
  const scale = Math.min(QR / img.naturalWidth, LOGO / img.naturalHeight);
  const lw = img.naturalWidth * scale;
  const lh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - lw) / 2, PAD + (LOGO - lh) / 2, lw, lh);

  drawModules(ctx, m, PAD, PAD + LOGO + GAP, QR, '#ffffff');
  return el;
}

/** Luminance relative (0 : noir, 1 : blanc) d'une couleur #rrggbb. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre deux couleurs (1 à 21) : en dessous de ~3, un QR code se lit mal. */
export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Enregistre le dessin en PNG. */
export function downloadCanvas(el: HTMLCanvasElement, filename: string) {
  const a = document.createElement('a');
  a.href = el.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
