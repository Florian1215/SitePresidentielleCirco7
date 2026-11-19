import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';

/**
 * Abonnement à un calendrier de l'agenda (flux iCalendar servi par Django) :
 *   - tout l'agenda : /api/agenda.ics
 *   - une ville : /api/agenda/<slug>.ics (proposé sur la fiche de chaque groupe d'action)
 * Contrairement à « Ajouter à mon agenda » (un événement), l'application de la personne relit le flux
 * régulièrement : nouveaux rendez-vous, changements et annulations y apparaissent tout seuls.
 */
export interface CalendarFeed {
  /** Ville (nom en français, comme renvoyé par le serveur) ; null = tout l'agenda. */
  city: string | null;
  slug: string | null;
}

export function feedUrl(slug: string | null): string {
  return `${window.location.origin}/api/agenda${slug ? `/${slug}` : ''}.ics`;
}

const webcal = (url: string) => url.replace(/^https?:/, 'webcal:');

/** Pictogramme calendrier (Font Awesome Free 6.7.2, « calendar-plus » regular, CC BY 4.0). */
export function CalendarIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} fill-current`} viewBox="0 0 448 512" aria-hidden="true" focusable="false">
      <path d="M152 24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H64C28.7 64 0 92.7 0 128v16 48V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192 144 128c0-35.3-28.7-64-64-64H344V24c0-13.3-10.7-24-24-24s-24 10.7-24 24V64H152V24zM48 192H400V448c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192zm176 40c-13.3 0-24 10.7-24 24v48H152c-13.3 0-24 10.7-24 24s10.7 24 24 24h48v48c0 13.3 10.7 24 24 24s24-10.7 24-24V352h48c13.3 0 24-10.7 24-24s-10.7-24-24-24H248V256c0-13.3-10.7-24-24-24z" />
    </svg>
  );
}

/** Fenêtre « S'abonner à l'agenda » ; `feed` null = fermée. */
export function CalendarSubscribeDialog({ feed, onClose }: { feed: CalendarFeed | null; onClose: () => void }) {
  const i18n = useI18n();
  const t = i18n.d.calendarFeed;
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (feed && !d.open) {
      setCopied(false);
      d.showModal();
    } else if (!feed && d.open) d.close();
  }, [feed]);

  const url = feed ? feedUrl(feed.slug) : '';
  const city = feed?.city ? i18n.city(feed.city) : null;
  const title = city ? i18n.f(t.titleCity, { city }) : t.titleAll;
  const calName = `LFI 7e circo — ${city ?? 'Agenda'}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* presse-papiers indisponible : l'adresse reste sélectionnable dans le champ */
    }
  };

  const option =
    'flex items-center gap-3 rounded-lg border border-gris bg-white px-4 py-3 font-bold text-violet no-underline hover:border-violet hover:bg-lavande hover:text-violet';

  return (
    <dialog
      ref={dialog}
      className="m-auto w-[min(480px,calc(100vw-24px))] max-w-none rounded-site border-0 bg-creme p-0 shadow-site backdrop:bg-noir/60"
      aria-labelledby="calendar-feed-title"
      onClose={onClose}
      onClick={(e) => {
        // Clic sur le fond (en dehors de la fenêtre) : fermeture
        if (e.target === dialog.current) dialog.current?.close();
      }}
    >
      {feed && (
        <div className="grid gap-4 p-[clamp(18px,4vw,28px)]">
          <div className="flex items-start justify-between gap-4">
            <h2 id="calendar-feed-title" className="m-0 flex items-center gap-2.5 text-[24px]">
              <CalendarIcon className="h-6 w-6 shrink-0" />
              {title}
            </h2>
            <button
              type="button"
              className="-mt-1 -mr-1 grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[22px] leading-none text-violet hover:bg-lavande"
              aria-label={t.close}
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </div>
          <div className="grid gap-2">
            <a
              className={option}
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal(url))}`}
              target="_blank"
              rel="noopener"
            >
              {t.google}
            </a>
            <a
              className={option}
              href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent(calName)}`}
              target="_blank"
              rel="noopener"
            >
              {t.outlook}
            </a>
            <a className={option} href={webcal(url)}>
              {t.apple}
            </a>
          </div>

          <div className="grid">
            <label htmlFor="calendar-feed-url" className="visually-hidden">
              {t.copyLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="calendar-feed-url"
                type="text"
                readOnly
                value={url}
                className="min-w-0 flex-1 bg-white py-1.5! text-[14px]"
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className="btn btn-sm shrink-0" onClick={copy}>
                {copied ? t.copied : t.copy}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
