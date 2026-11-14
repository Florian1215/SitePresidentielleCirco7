import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../lib/i18n';
import type { CampaignEvent } from '../lib/models';
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from './calendar-links';

/** Pictogramme calendrier (Font Awesome Free, solid « calendar-plus », CC BY 4.0). */
const CAL_ICON =
  'M96 32l0 32L48 64C21.5 64 0 85.5 0 112l0 48 448 0 0-48c0-26.5-21.5-48-48-48l-48 0 0-32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 32L160 64l0-32c0-17.7-14.3-32-32-32S96 14.3 96 32zM448 192L0 192 0 464c0 26.5 21.5 48 48 48l352 0c26.5 0 48-21.5 48-48l0-272zM224 248c13.3 0 24 10.7 24 24l0 56 56 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-56 0 0 56c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-56-56 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l56 0 0-56c0-13.3 10.7-24 24-24z';

const MENU_ITEM =
  'block w-full cursor-pointer rounded-md border-0 bg-transparent px-3 py-[9px] text-left [font-family:inherit] text-[14px] font-bold text-noir no-underline hover:bg-lavande hover:text-violet';

/** Carte d'un événement de l'agenda (calendrier Zetkin). */
export function EventCard({ event: e }: { event: CampaignEvent }) {
  const i18n = useI18n();
  const menu = useRef<HTMLDetailsElement>(null);

  // Ferme le menu « Ajouter à mon agenda » quand on clique ailleurs.
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const el = menu.current;
      if (el?.open && !el.contains(ev.target as Node)) el.open = false;
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const v = useMemo(() => {
    const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString(i18n.locale, o);
    // Les heures Zetkin sont « flottantes » (heure locale du lieu) : on les lit sans conversion de fuseau.
    const start = new Date(e.start);
    const end = new Date(e.end);
    const long = fmt(start, { weekday: 'long', day: 'numeric', month: 'long' });
    // 15h00 en français, 15:00 en anglais et en allemand
    const t = (d: Date) => {
      const s = fmt(d, { hour: '2-digit', minute: '2-digit', hour12: false });
      return i18n.lang === 'fr' ? s.replace(':', 'h') : s;
    };
    const sameDay = start.toDateString() === end.toDateString();
    return {
      day: start.getDate(),
      month: fmt(start, { month: 'short' }).replace('.', ''),
      /** « Samedi 14 novembre » (majuscule au jour seulement). */
      longDate: long.charAt(0).toUpperCase() + long.slice(1),
      weekday: fmt(start, { weekday: 'short' }).replace('.', ''),
      when: sameDay ? `${t(start)} – ${t(end)}` : `${t(start)} → ${fmt(end, { day: 'numeric', month: 'long' })}`,
      excerpt: e.description.replace(/\s*\n+\s*/g, ' ').trim(),
      google: googleCalendarUrl(e, i18n.d.event.signup),
      outlook: outlookCalendarUrl(e, i18n.d.event.signup),
    };
  }, [e, i18n]);

  return (
    // La carte dont le menu est ouvert passe au-dessus de ses voisines
    <div className="block h-full has-[details[open]]:relative has-[details[open]]:z-10">
      <article className="flex h-full flex-col rounded-site bg-white shadow-site transition-[translate,box-shadow] duration-200 ease-[ease] hover:-translate-y-[3px] hover:shadow-[0_16px_36px_rgba(33,35,32,.14)] motion-reduce:hover:translate-y-0">
        {/* Visuel : l'affiche entière, sur un fond flouté de la même image */}
        <div
          className={`relative aspect-[16/10] overflow-hidden rounded-t-site ${e.image ? 'bg-violet' : 'bg-[linear-gradient(135deg,var(--color-violet),var(--color-violet-vif))]'}`}
        >
          {e.image && (
            <>
              <img className="absolute inset-0 h-full w-full scale-[1.2] object-cover opacity-75 blur-[18px] saturate-[1.2]" src={e.image} alt="" loading="lazy" decoding="async" aria-hidden="true" />
              <img className="relative h-full w-full object-contain" src={e.image} alt="" loading="lazy" decoding="async" />
            </>
          )}
          {/* Date façon feuille de calendrier, posée sur le visuel */}
          <div className="absolute bottom-3 left-3.5 flex w-16 flex-col items-center overflow-hidden rounded-[10px] bg-white text-center shadow-[0_6px_16px_rgba(0,0,0,.25)]" aria-hidden="true">
            <span className="self-stretch bg-rouge py-[3px] text-[11px] font-bold tracking-[.06em] text-creme uppercase">{v.month}</span>
            <span className="mt-0.5 font-titre text-[32px] leading-[1.05] text-noir">{v.day}</span>
            <span className="mb-[5px] text-[11px] font-bold text-texte capitalize">{v.weekday}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-start px-[18px] pt-4 pb-[18px]">
          <p className="m-0 mb-2 flex flex-col gap-0.5 text-[13px]">
            <span className="font-bold text-rouge">
              {v.longDate} · {v.when}
            </span>
            {e.location && <span className="font-medium text-texte [overflow-wrap:anywhere]">{e.location}</span>}
          </p>
          <h3 className="m-0 mb-2 line-clamp-2 font-texte text-[18px] leading-[1.3] font-bold text-noir [overflow-wrap:anywhere]">{e.title}</h3>
          {v.excerpt && <p className="m-0 mb-4 line-clamp-3 text-[14px] text-texte [overflow-wrap:anywhere]">{v.excerpt}</p>}

          <div className="mt-auto flex flex-wrap gap-2">
            <a href={e.url} target="_blank" rel="noopener" className="btn btn-rouge btn-sm">
              {i18n.d.event.join}
              <span className="visually-hidden"> : {e.title}</span>
            </a>
            <details className="group relative" ref={menu}>
              <summary
                className="btn btn-outline btn-sm list-none gap-2 group-open:bg-violet group-open:text-creme [&::-webkit-details-marker]:hidden"
                title={i18n.d.event.addToCalendar}
                aria-label={i18n.d.event.addToCalendar}
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 448 512" aria-hidden="true">
                  <path d={CAL_ICON} />
                </svg>
                {i18n.d.event.calendar}
              </summary>
              <ul
                className="absolute top-[calc(100%+6px)] left-0 z-[5] m-0 min-w-[230px] list-none rounded-[10px] bg-white p-1.5 shadow-[0_12px_30px_rgba(33,35,32,.2)]"
                onClick={() => menu.current && (menu.current.open = false)}
              >
                <li>
                  <a className={MENU_ITEM} href={v.google} target="_blank" rel="noopener">
                    Google Agenda
                  </a>
                </li>
                <li>
                  <a className={MENU_ITEM} href={v.outlook} target="_blank" rel="noopener">
                    Outlook
                  </a>
                </li>
                <li>
                  <button type="button" className={MENU_ITEM} onClick={() => downloadIcs(e, i18n.d.event.signup)}>
                    {i18n.d.event.icsOption}
                  </button>
                </li>
              </ul>
            </details>
          </div>
        </div>
      </article>
    </div>
  );
}
