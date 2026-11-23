"""Calendriers auxquels s'abonner (format iCalendar) : tout l'agenda, ou les événements d'une ville.

  /api/agenda.ics           → tous les événements publics de l'agenda Zetkin
  /api/agenda/<ville>.ics   → ceux d'une ville (« munich », « dusseldorf »…), proposé sur la fiche de chaque groupe d'action

Les événements viennent de la table ZetkinEvent (projets publics seulement), synchronisée avec Zetkin toutes les heures.
Chaque événement garde l'identifiant Zetkin : une modification ou une annulation se répercute dans l'agenda
des abonné·es à la prochaine mise à jour de leur application (Google : toutes les 12 à 24 h ; Apple : réglable).
Les heures restent « flottantes » (heure locale du lieu), comme dans le calendrier Zetkin.
"""

from datetime import datetime, timezone

from django.http import Http404, HttpResponse
from django.utils.text import slugify
from django.views import View

from .models import ZetkinEvent
from .zetkin import CITIES

CALENDAR_NAME = "LFI 7e circo"


def city_slug(name):
    """« Düsseldorf » → « dusseldorf », « Brême » → « breme »."""
    return slugify(name)


CITY_BY_SLUG = {city_slug(name): name for name in CITIES}


def _escape(text):
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")


def _fold(line):
    """Lignes de 75 octets au plus, suite précédée d'un espace (RFC 5545), sans couper un caractère UTF-8."""
    parts, current, size = [], "", 0
    for char in line:
        n = len(char.encode("utf-8"))
        if size + n > (75 if not parts else 74):
            parts.append(current)
            current, size = "", 0
        current += char
        size += n
    parts.append(current)
    return "\r\n ".join(parts)


def _compact(iso):
    """2026-11-14T15:00:00 → 20261114T150000 (heure flottante)."""
    return iso.replace("-", "").replace(":", "")[:15]


def build_calendar(events, name, description):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LFI 7e circonscription//Agenda//FR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(name)}",
        f"NAME:{_escape(name)}",
        f"X-WR-CALDESC:{_escape(description)}",
        f"DESCRIPTION:{_escape(description)}",
        # Fréquence de mise à jour suggérée aux applications (respectée par Apple, Outlook, Thunderbird)
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
    ]
    for e in events:
        details = "\n\n".join(filter(None, [e.get("description", ""), f"Inscription : {e['url']}" if e.get("url") else ""]))
        lines += [
            "BEGIN:VEVENT",
            f"UID:{_escape(e['id'])}@agenda-7e-circo",
            f"DTSTAMP:{stamp}",
            f"DTSTART:{_compact(e['start'])}",
            f"DTEND:{_compact(e['end'])}",
            f"SUMMARY:{_escape(e['title'])}",
        ]
        if details:
            lines.append(f"DESCRIPTION:{_escape(details)}")
        if e.get("location"):
            lines.append(f"LOCATION:{_escape(e['location'])}")
        if e.get("latitude") is not None and e.get("longitude") is not None:
            lines.append(f"GEO:{e['latitude']};{e['longitude']}")
        if e.get("url"):
            lines.append(f"URL:{e['url']}")
        if e.get("category"):
            lines.append(f"CATEGORIES:{_escape(e['category'])}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


def _response(body, filename):
    response = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    response["Cache-Control"] = "public, max-age=900"
    return response


class AgendaFeedView(View):
    """Tout l'agenda public."""

    def get(self, request):
        body = build_calendar([e.as_dict() for e in ZetkinEvent.objects.all()], f"{CALENDAR_NAME} — Agenda", "Les rendez-vous de la campagne dans la 7e circonscription.")
        return _response(body, "agenda-7e-circo.ics")


class CityAgendaFeedView(View):
    """Les événements d'une ville."""

    def get(self, request, slug):
        city = CITY_BY_SLUG.get(slug.lower())
        if not city:
            raise Http404("Ville inconnue")
        events = [e.as_dict() for e in ZetkinEvent.objects.filter(city=city)]
        body = build_calendar(events, f"{CALENDAR_NAME} — {city}", f"Les rendez-vous de la campagne à {city}.")
        return _response(body, f"agenda-{slug}.ics")
