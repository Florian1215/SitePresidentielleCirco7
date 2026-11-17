"""Récupération des groupes d'action de la circonscription sur Action populaire.

Deux sources publiques, complémentaires :
- la liste qui alimente la carte d'Action populaire (tous pays, avec coordonnées) ;
- la recherche, interrogée ville par ville (certains groupes n'apparaissent que là).
"""
import json
import logging
import threading
import time
import uuid
import urllib.parse
import urllib.request

from django.core.cache import cache, caches
from django.db import close_old_connections, connection

from .models import COUNTRIES

logger = logging.getLogger(__name__)

BASE = "https://actionpopulaire.fr"
CIRCO = {code for code, _ in COUNTRIES if code != "XX"}
USER_AGENT = "site-7e-circo/1.0"

# Villes et pays interrogés dans la recherche d'Action populaire
SEARCH_TERMS = [
    "Allemagne", "Berlin", "Hambourg", "Hamburg", "Brême", "Bremen", "Kiel", "Hanovre", "Leipzig", "Dresde", "Dresden",
    "Munich", "München", "Stuttgart", "Fribourg", "Freiburg", "Nuremberg", "Karlsruhe", "Francfort", "Frankfurt",
    "Darmstadt", "Heidelberg", "Mannheim", "Sarrebruck", "Tübingen", "Cologne", "Köln", "Düsseldorf", "Bonn",
    "Bielefeld", "NRW", "Autriche", "Vienne", "Wien", "Graz", "Linz", "Innsbruck", "Salzbourg", "Tchéquie", "Prague",
    "Pologne", "Varsovie", "Cracovie", "Hongrie", "Budapest", "Roumanie", "Bucarest", "Serbie", "Belgrade",
    "Bulgarie", "Sofia", "Croatie", "Zagreb", "Slovaquie", "Bratislava", "Slovénie", "Ljubljana", "Bosnie",
    "Sarajevo", "Macédoine", "Skopje", "Albanie", "Tirana", "Monténégro", "Podgorica", "Kosovo", "Pristina",
]


def _get_json(path):
    request = urllib.request.Request(BASE + path, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def group_url(ap_id):
    return f"{BASE}/groupes/{ap_id}/"


def fetch_groups(pause=0.3):
    """Renvoie {ap_id: {name, city, country, latitude, longitude, url}} pour les pays de la circonscription."""
    groups = {}

    for g in _get_json("/carte/liste_groupes/"):
        coords = (g.get("coordinates") or {}).get("coordinates")
        if g.get("type") == "L" and g.get("location_country") in CIRCO and coords:
            groups[g["id"]] = {
                "name": g["name"], "city": "", "country": g["location_country"],
                "longitude": coords[0], "latitude": coords[1], "url": group_url(g["id"]),
            }

    for term in SEARCH_TERMS:
        data = _get_json("/api/recherche/?" + urllib.parse.urlencode({"q": term}))
        for g in data.get("groups", []):
            loc = g.get("location") or {}
            coords = (loc.get("coordinates") or {}).get("coordinates")
            if loc.get("country") in CIRCO and coords:
                entry = groups.setdefault(g["id"], {
                    "name": g["name"], "country": loc["country"],
                    "longitude": coords[0], "latitude": coords[1], "url": group_url(g["id"]),
                })
                entry["city"] = loc.get("city") or entry.get("city", "")
        time.sleep(pause)

    return groups


IMPORT_KEY = "ap-import"


def import_new_groups():
    """Crée les groupes d'Action populaire absents de la base ; les groupes déjà connus ne sont pas modifiés."""
    from .models import ActionGroup

    groups = fetch_groups()
    known = {str(i) for i in ActionGroup.objects.exclude(ap_id=None).values_list("ap_id", flat=True)}
    new = [ActionGroup(ap_id=ap_id, **data) for ap_id, data in groups.items() if str(ap_id) not in known]
    ActionGroup.objects.bulk_create(new)
    return len(groups), [{"name": g.name, "city": g.city, "country": g.get_country_display()} for g in new]


def start_import_in_background():
    """Lance l'import dans un fil d'exécution (il dure ~1 min, plus que le délai du serveur web).

    Renvoie l'identifiant de l'import, ou None si un import est déjà en cours.
    Son état se lit avec import_status(job) pendant une heure, puis il est oublié.
    """
    shared = caches["shared"]
    job = uuid.uuid4().hex
    if not shared.add(IMPORT_KEY + "-lock", job, 600):
        return None
    shared.set(f"{IMPORT_KEY}-{job}", {"state": "running"}, 3600)

    def run():
        close_old_connections()
        try:
            found, created = import_new_groups()
            status = {"state": "done", "found": found, "created": created}
        except Exception as err:
            logger.exception("Import des groupes d'action impossible")
            status = {"state": "error", "error": str(err)}
        finally:
            connection.close()
        shared.set(f"{IMPORT_KEY}-{job}", status, 3600)
        shared.delete(IMPORT_KEY + "-lock")

    threading.Thread(target=run, daemon=True).start()
    return job


def import_status(job):
    return caches["shared"].get(f"{IMPORT_KEY}-{job}")


def supporters_count():
    """Nombre de soutiens à la candidature (compteur affiché sur melenchon2027.fr), mis en cache 1 minute.

    Renvoie None si Action populaire est injoignable et qu'aucune valeur récente n'est connue.
    """
    count = cache.get("ap-supporters-count")
    if count is None:
        try:
            count = int(_get_json("/api/soutien/count/")["count"])
            cache.set("ap-supporters-count", count, 60)
            cache.set("ap-supporters-count-last", count, None)  # dernière valeur connue, sans expiration
        except Exception:
            logger.exception("Impossible de lire le compteur de soutiens d'Action populaire")
            count = cache.get("ap-supporters-count-last")
    return count
