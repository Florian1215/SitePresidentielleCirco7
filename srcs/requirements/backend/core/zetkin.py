"""Agenda de la campagne, lu dans le calendrier public Zetkin (format iCalendar).

L'API Zetkin demande une authentification ; le flux .ics public suffit et contient
titre, dates, lieu, coordonnées, image et lien d'inscription de chaque événement.
Les heures du flux sont « flottantes » : c'est l'heure locale du lieu de l'événement.
"""
import logging
import math
import re
import urllib.request
from datetime import datetime, timedelta

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Villes de la circonscription : la ville d'un événement est la plus proche de ses coordonnées (35 km max).
CITIES = {
    "Berlin": (52.520, 13.405), "Hambourg": (53.551, 9.994), "Munich": (48.137, 11.575),
    "Francfort": (50.111, 8.682), "Cologne": (50.938, 6.960), "Düsseldorf": (51.227, 6.773),
    "Stuttgart": (48.776, 9.182), "Leipzig": (51.340, 12.375), "Dresde": (51.050, 13.738),
    "Hanovre": (52.375, 9.732), "Brême": (53.079, 8.802), "Nuremberg": (49.452, 11.077),
    "Karlsruhe": (49.007, 8.404), "Fribourg": (47.999, 7.842), "Heidelberg": (49.399, 8.672),
    "Mannheim": (49.487, 8.466), "Bonn": (50.737, 7.098), "Kiel": (54.323, 10.123),
    "Sarrebruck": (49.240, 6.997), "Darmstadt": (49.872, 8.651), "Tübingen": (48.522, 9.052),
    "Bielefeld": (52.030, 8.532), "Vienne": (48.208, 16.373), "Graz": (47.071, 15.439),
    "Linz": (48.306, 14.286), "Prague": (50.075, 14.437), "Varsovie": (52.230, 21.012),
    "Cracovie": (50.065, 19.945), "Budapest": (47.498, 19.040), "Bucarest": (44.427, 26.103),
    "Belgrade": (44.787, 20.457), "Sofia": (42.698, 23.322), "Zagreb": (45.815, 15.982),
    "Bratislava": (48.149, 17.107), "Ljubljana": (46.057, 14.506), "Sarajevo": (43.856, 18.413),
    "Skopje": (41.998, 21.425), "Tirana": (41.328, 19.819), "Podgorica": (42.441, 19.263),
    "Pristina": (42.663, 21.166),
}
# Noms rencontrés dans les titres (« Munich - … », « München - … »)
CITY_ALIASES = {"münchen": "Munich", "wien": "Vienne", "hamburg": "Hambourg", "frankfurt": "Francfort",
                "köln": "Cologne", "dresden": "Dresde", "hannover": "Hanovre", "bremen": "Brême",
                "nürnberg": "Nuremberg", "freiburg": "Fribourg", "saarbrücken": "Sarrebruck",
                "praha": "Prague", "warszawa": "Varsovie", "kraków": "Cracovie", "bucurești": "Bucarest",
                "beograd": "Belgrade"}
ONLINE = "En ligne"


def _distance_km(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def guess_city(title, location, lat, lon):
    """Ville de l'événement : d'après ses coordonnées, sinon le début du titre ; « En ligne » sans lieu."""
    if lat is not None and lon is not None:
        name, dist = min(((n, _distance_km((lat, lon), c)) for n, c in CITIES.items()), key=lambda x: x[1])
        if dist <= 35:
            return name
    prefix = re.split(r"\s[-–—:]\s", title, maxsplit=1)[0].strip().lower()
    prefix = re.sub(r"^[^\w]+", "", prefix)  # retire un éventuel émoji en tête
    for name in CITIES:
        if prefix == name.lower():
            return name
    if prefix in CITY_ALIASES:
        return CITY_ALIASES[prefix]
    if not location and lat is None:
        return ONLINE
    return None


CACHE_KEY = "zetkin-events"
CACHE_SECONDS = 15 * 60
USER_AGENT = "site-7e-circo/1.0"


def _unfold(text):
    """Recolle les lignes repliées (RFC 5545 : une ligne qui commence par un espace ou une tabulation)."""
    return re.sub(r"\r?\n[ \t]", "", text)


def _unescape(value):
    return (value.replace("\\n", "\n").replace("\\N", "\n")
            .replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\"))


def _parse_date(value):
    value = value.rstrip("Z")
    for fmt in ("%Y%m%dT%H%M%S", "%Y%m%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass
    return None


def parse_ics(text):
    events = []
    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", _unfold(text), re.S):
        props = {}
        for line in block.strip().splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            name = key.split(";", 1)[0].upper()
            props.setdefault(name, value)

        start = _parse_date(props.get("DTSTART", ""))
        if not start:
            continue
        end = _parse_date(props.get("DTEND", "")) or start + timedelta(hours=2)

        description = _unescape(props.get("DESCRIPTION", ""))
        # Zetkin ajoute « Join event here: <lien> » en tête de la description
        description = re.sub(r"^Join event here:\s*\S+\s*", "", description).strip()

        lat = lon = None
        if ";" in props.get("GEO", ""):
            try:
                lat, lon = (float(v) for v in props["GEO"].split(";", 1))
            except ValueError:
                pass

        uid = props.get("UID", "")
        title = _unescape(props.get("SUMMARY", "")).strip()
        location = _unescape(props.get("LOCATION", "")).strip()
        events.append({
            "id": uid.split("@", 1)[0] or uid,
            "title": title,
            "description": description,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "location": location,
            "city": guess_city(title, location, lat, lon),
            "latitude": lat,
            "longitude": lon,
            "url": props.get("URL", "").strip(),
            "image": props.get("IMAGE", "").strip() or None,
        })
    return sorted(events, key=lambda e: e["start"])


def fetch_events():
    """Événements du calendrier Zetkin, mis en cache 15 minutes. Liste vide si Zetkin est injoignable."""
    events = cache.get(CACHE_KEY)
    if events is None:
        try:
            request = urllib.request.Request(settings.ZETKIN_ICS_URL, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=15) as response:
                events = parse_ics(response.read().decode("utf-8"))
            cache.set(CACHE_KEY, events, CACHE_SECONDS)
        except Exception:  # réseau, format… : on n'empêche pas la page de s'afficher
            logger.exception("Impossible de lire le calendrier Zetkin")
            events = []
            cache.set(CACHE_KEY, events, 60)
    return events


def upcoming_events():
    """Événements pas encore terminés (comparaison sur l'heure locale, à quelques heures près)."""
    now = datetime.now().isoformat()
    return [e for e in fetch_events() if e["end"] >= now]
