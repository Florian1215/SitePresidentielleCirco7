import { useEffect, useRef, useState } from 'react';
import { Flag } from './Flag';
import { LANGS } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import { api } from '../lib/api';
import type { ActionGroup } from '../lib/models';
import { contrast, DEFAULT_QR_LOGO, downloadCanvas, fileSlug, renderQr, VIOLET } from '../lib/qr';
import type { QrOptions, QrStyle } from '../lib/qr';

/**
 * Lien à partager (tracker, page d'un groupe d'action) : langue du lien (drapeau, menu des langues), adresse,
 * « Copier » et « QR code », qui ouvre l'éditeur de QR code.
 */
export function QrLink({
  urlFor,
  name,
  logo,
  id,
}: {
  /** Adresse du lien dans une langue. */
  urlFor: (lang: Lang) => string;
  /** Nom du tracker ou du groupe : nom des fichiers téléchargés. */
  name: string;
  /** Logo du sticker (logo du groupe d'action) ; par défaut, le logo Circo7. */
  logo?: string | null;
  /** Identifiant unique sur la page (champs de formulaire). */
  id: string;
}) {
  const [lang, setLang] = useState<Lang>('fr');
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const url = urlFor(lang);
  const current = LANGS.find((l) => l.code === lang)!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible : le lien reste sélectionnable dans le champ */
    }
  };

  return (
    <div className="flex items-center gap-2 max-[620px]:flex-wrap">
      <LangMenu
        id={`${id}-lang`}
        lang={lang}
        onChange={(l) => {
          setLang(l);
          setCopied(false);
        }}
      />
      <label htmlFor={`${id}-url`} className="visually-hidden">
        Lien en {current.label}
      </label>
      <input
        id={`${id}-url`}
        type="text"
        readOnly
        value={url}
        className="min-w-0 flex-1 bg-white py-1.5! text-[14px] max-[620px]:basis-[calc(100%-52px)]"
        onFocus={(e) => e.target.select()}
      />
      <div className="flex shrink-0 gap-2 max-[620px]:w-full max-[620px]:pl-[52px]">
        <button type="button" className="btn btn-sm min-w-[96px]" onClick={copy}>
          {copied ? '✓ Copié' : 'Copier'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setQrOpen(true)}>
          QR code
        </button>
      </div>
      <QrDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        filename={`qr-${fileSlug(name)}-${lang}`}
        logo={logo}
        langLabel={current.label}
      />
    </div>
  );
}

/** Choix de la langue du lien : bouton avec le drapeau, qui ouvre la liste des langues (drapeau et nom). */
function LangMenu({ id, lang, onChange }: { id: string; lang: Lang; onChange: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang)!;

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
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Langue du lien : ${current.label}`}
        title={`Lien en ${current.label}`}
        onClick={() => setOpen(!open)}
        className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[6px] border-2 border-gris bg-white px-2 hover:border-violet"
      >
        <Flag lang={lang} className="h-[18px] w-[27px]" />
        <span aria-hidden="true" className={`text-[11px] text-texte transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute top-[calc(100%+4px)] left-0 z-20 m-0 grid min-w-[170px] list-none gap-0.5 rounded-lg border border-gris bg-white p-1 shadow-site"
        >
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === lang}>
              <button
                type="button"
                onClick={() => {
                  onChange(l.code);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-2.5 py-2 text-left text-[14px] font-bold ${l.code === lang ? 'bg-lavande text-violet' : 'bg-transparent text-noir hover:bg-lavande'}`}
              >
                <Flag lang={l.code} className="h-[16px] w-[24px]" />
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STYLES: { value: QrStyle; label: string; hint: string }[] = [
  { value: 'classic', label: 'Classique', hint: 'couleurs au choix' },
  { value: 'sticker', label: 'Sticker', hint: 'fond violet, logo en haut' },
];

/** Couleurs proposées en un clic (en plus de la roue chromatique). */
const SWATCHES = [
  { value: '#000000', label: 'Noir' },
  { value: '#ffffff', label: 'Blanc' },
  { value: VIOLET, label: 'Violet' },
];

/**
 * Choix d'une couleur : pastilles rapides (et « transparent » si `allowNone`), puis la roue chromatique
 * (sélecteur de couleur du navigateur) pour toutes les autres couleurs.
 */
function ColorChoice({
  legend,
  value,
  onChange,
  allowNone = false,
  name,
}: {
  legend: string;
  value: string | null;
  onChange: (c: string | null) => void;
  allowNone?: boolean;
  name: string;
}) {
  const custom = value !== null && !SWATCHES.some((s) => s.value === value);
  const ring = (on: boolean) => (on ? 'outline-3 outline-offset-2 outline-violet' : 'outline-0');
  const swatch = 'h-8 w-8 shrink-0 cursor-pointer rounded-full border border-gris';
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-[14px] font-bold">{legend}</legend>
      <div className="flex flex-wrap items-center gap-2.5">
        {allowNone && (
          <button
            type="button"
            title="Transparent"
            aria-label="Transparent"
            aria-pressed={value === null}
            onClick={() => onChange(null)}
            className={`${swatch} ${ring(value === null)}`}
            style={{ background: CHECKER_SMALL }}
          />
        )}
        {SWATCHES.map((s) => (
          <button
            key={s.value}
            type="button"
            title={s.label}
            aria-label={s.label}
            aria-pressed={value === s.value}
            onClick={() => onChange(s.value)}
            className={`${swatch} ${ring(value === s.value)}`}
            style={{ background: s.value }}
          />
        ))}
        {/* Roue chromatique : ouvre le sélecteur de couleur ; affiche la couleur choisie au centre */}
        <label
          className={`relative ${swatch} grid place-items-center ${ring(custom)}`}
          style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
          title="Toutes les couleurs"
        >
          <span
            className="h-4 w-4 rounded-full border-2 border-white"
            style={{ background: custom ? value! : '#ffffff' }}
            aria-hidden="true"
          />
          <input
            type="color"
            name={name}
            value={value ?? '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${legend} : toutes les couleurs`}
          />
        </label>
      </div>
    </fieldset>
  );
}

/** Fond en damier : montre la transparence de l'aperçu. */
const CHECKER = 'repeating-conic-gradient(#d9d6cf 0% 25%, #ffffff 0% 50%) 50% / 20px 20px';
/** Damier foncé : transparence d'un QR code clair (blanc sur fond transparent). */
const CHECKER_DARK = 'repeating-conic-gradient(#3a3c39 0% 25%, #5a5c58 0% 50%) 50% / 20px 20px';
const CHECKER_SMALL = 'repeating-conic-gradient(#d9d6cf 0% 25%, #ffffff 0% 50%) 50% / 10px 10px';

/** Éditeur de QR code : choix du style, aperçu, téléchargement en PNG. */
function QrDialog({
  open,
  onClose,
  url,
  filename,
  logo,
  langLabel,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  filename: string;
  logo?: string | null;
  langLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [style, setStyle] = useState<QrStyle>('classic');
  /** Classique : couleur du QR code et du fond (null : transparent). */
  const [fg, setFg] = useState('#000000');
  const [bg, setBg] = useState<string | null>('#ffffff');
  const [drawn, setDrawn] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  /** Logo du sticker : celui du groupe de la page (sinon Circo7), ou celui d'un autre groupe choisi dans la liste. */
  const [stickerLogo, setStickerLogo] = useState(logo || DEFAULT_QR_LOGO);
  /** Groupes d'action qui ont un logo (chargés à la première ouverture du style « Sticker »). */
  const [logoGroups, setLogoGroups] = useState<ActionGroup[] | null>(null);

  useEffect(() => setStickerLogo(logo || DEFAULT_QR_LOGO), [logo]);

  useEffect(() => {
    if (!open || style !== 'sticker' || logoGroups) return;
    api.actionGroups().then(
      (list) => setLogoGroups(list.filter((g) => g.logo).sort((a, b) => a.name.localeCompare(b.name, 'fr'))),
      () => setLogoGroups([]),
    );
  }, [open, style, logoGroups]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError('');
    setDrawn(null);
    const opts: QrOptions = style === 'classic' ? { style, fg, bg } : { style, logo: stickerLogo };
    renderQr(url, opts).then(
      (el) => {
        if (!alive) return;
        setDrawn(el);
        setPreview(el.toDataURL('image/png'));
      },
      () => alive && setError('Impossible de créer le QR code.'),
    );
    return () => {
      alive = false;
    };
  }, [open, url, style, fg, bg, stickerLogo]);

  /** QR code clair sans fond : damier foncé, pour voir à la fois la transparence et le QR code. */
  const dark = style === 'classic' && bg === null && contrast(fg, '#ffffff') < 2;
  /** Couleurs trop proches : le QR code se lira mal. */
  const lowContrast = style === 'classic' && bg !== null && contrast(fg, bg) < 3;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      aria-labelledby="qr-dialog-title"
      className="m-auto w-[min(720px,94vw)] rounded-site border-0 p-0 shadow-site backdrop:bg-noir/60"
    >
      <div className="grid gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="qr-dialog-title" className="m-0 text-[22px] text-violet">
              QR code
            </h2>
            <p className="m-0 text-[13px] break-all text-texte">
              Lien en {langLabel} : {url}
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="grid grid-cols-[240px_1fr] gap-5 max-[620px]:grid-cols-1">
          <fieldset className="m-0 grid content-start gap-2 border-0 p-0">
            <legend className="mb-2 p-0 font-bold text-violet">Style</legend>
            {STYLES.map((s) => (
              <label
                key={s.value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 px-3 py-2 ${style === s.value ? 'border-violet bg-lavande' : 'border-gris bg-white hover:border-violet'}`}
              >
                <input
                  type="radio"
                  name="qr-style"
                  value={s.value}
                  checked={style === s.value}
                  onChange={() => setStyle(s.value)}
                  className="mt-1"
                />
                <span className="grid">
                  <strong className="text-[15px]">{s.label}</strong>
                  <span className="text-[12px] text-texte">{s.hint}</span>
                </span>
              </label>
            ))}
            {style === 'classic' && (
              <div className="mt-2 grid gap-4">
                <ColorChoice legend="Couleur du QR code" name="qr-fg" value={fg} onChange={(c) => c && setFg(c)} />
                <ColorChoice legend="Couleur du fond" name="qr-bg" value={bg} onChange={setBg} allowNone />
                {lowContrast && (
                  <p className="m-0 text-[13px] font-bold text-rouge">
                    Couleurs trop proches : le QR code risque de ne pas se lire.
                  </p>
                )}
              </div>
            )}
            {style === 'sticker' && (
              <div className="field m-0 mt-1">
                <label htmlFor="qr-sticker-logo" className="text-[14px]">
                  Logo du sticker
                </label>
                <select
                  id="qr-sticker-logo"
                  value={stickerLogo}
                  onChange={(e) => setStickerLogo(e.target.value)}
                  className="py-1.5! text-[14px]"
                >
                  <option value={DEFAULT_QR_LOGO}>Circo7</option>
                  {/* Logo du groupe de la page, s'il n'est pas dans la liste (groupe masqué de la carte) */}
                  {logo && !logoGroups?.some((g) => g.logo === logo) && <option value={logo}>Logo de ce groupe</option>}
                  {logoGroups?.map((g) => (
                    <option key={g.id} value={g.logo!}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>

          <div
            className="grid min-h-[260px] place-items-center rounded-lg p-4"
            style={{ background: dark ? CHECKER_DARK : CHECKER }}
          >
            {error ? (
              <p className="alert alert-err m-0">{error}</p>
            ) : preview ? (
              <img
                src={preview}
                alt={`Aperçu du QR code (${STYLES.find((s) => s.value === style)!.label})`}
                className="max-h-[380px] max-w-full"
              />
            ) : (
              <p className="loader m-0">Création…</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn"
            disabled={!drawn || !!error}
            onClick={() => drawn && downloadCanvas(drawn, `${filename}-${style === 'classic' ? 'classique' : 'sticker'}.png`)}
          >
            Télécharger (PNG)
          </button>
        </div>
      </div>
    </dialog>
  );
}
