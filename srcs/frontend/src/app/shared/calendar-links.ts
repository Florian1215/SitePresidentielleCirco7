import { CampaignEvent } from '../core/models';

/**
 * Liens « Ajouter à mon agenda » pour un événement.
 * Les heures Zetkin sont « flottantes » (heure locale du lieu) : on les transmet telles quelles,
 * sans fuseau, comme dans le calendrier d'origine.
 */

/** 2026-11-14T15:00:00 → 20261114T150000 */
const compact = (iso: string) => iso.replace(/[-:]/g, '').slice(0, 15);

function details(e: CampaignEvent) {
  return [e.description, `Inscription : ${e.url}`].filter(Boolean).join('\n\n');
}

export function googleCalendarUrl(e: CampaignEvent) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${compact(e.start)}/${compact(e.end)}`,
    details: details(e),
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(e: CampaignEvent) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    startdt: e.start,
    enddt: e.end,
    body: details(e),
    location: e.location,
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params}`;
}

function escapeIcs(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Replie les lignes longues (RFC 5545 : 75 caractères, suite précédée d'un espace). */
function fold(line: string) {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push((i ? ' ' : '') + line.slice(i, i + 74));
  return parts.join('\r\n');
}

/** Contenu .ics d'un seul événement (Apple Calendrier, Thunderbird, Proton…). */
export function icsContent(e: CampaignEvent) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LFI 7e circonscription//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id}@app.zetkin.org`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${compact(e.start)}`,
    `DTEND:${compact(e.end)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    e.location ? `LOCATION:${escapeIcs(e.location)}` : '',
    `DESCRIPTION:${escapeIcs(details(e))}`,
    `URL:${e.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Télécharge le fichier .ics de l'événement (ouvert directement par le calendrier sur mobile). */
export function downloadIcs(e: CampaignEvent) {
  const url = URL.createObjectURL(new Blob([icsContent(e)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFileName(e);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nom du fichier .ics proposé au téléchargement. */
export function icsFileName(e: CampaignEvent) {
  const slug = e.title
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50);
  return `${slug || 'evenement'}.ics`;
}
