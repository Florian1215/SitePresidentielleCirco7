"""Tâches Celery de l'app core (worker et planificateur : service « celery » des docker-compose).

sync_zetkin_events, toutes les heures (settings.CELERY_BEAT_SCHEDULE) et au démarrage du worker :
copie dans la table ZetkinEvent les événements des projets publics du calendrier Zetkin.
  - nouvel événement            → ajouté
  - événement modifié           → mis à jour (seulement les données qui ont changé)
  - événement identique         → pas réécrit
  - événement à venir disparu   → supprimé (annulé, ou passé dans un projet interne)
  - événement passé disparu     → gardé (historique)
Si Zetkin est injoignable, la base n'est pas touchée et la tâche réessaie un peu plus tard.

sync_supporters_count, toutes les heures et au démarrage du worker : enregistre dans la table SupportersCount
le nombre de soutiens à la candidature (Action populaire). En cas d'échec, le site garde le dernier relevé.
"""
import logging
from datetime import datetime

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .action_populaire import fetch_supporters_count
from .models import SupportersCount, ZetkinEvent
from .zetkin import fetch_public_events

logger = logging.getLogger(__name__)


def _aware(iso):
    """Heure flottante de Zetkin → heure de Paris (voir ZetkinEvent)."""
    return timezone.make_aware(datetime.fromisoformat(iso))


def _fields(e):
    """Champs de ZetkinEvent tirés d'un événement lu dans Zetkin."""
    return {
        "title": e["title"][:300],
        "description": e["description"],
        "start": _aware(e["start"]),
        "end": _aware(e["end"]),
        "location": e["location"][:300],
        "city": e["city"] or "",
        "latitude": e["latitude"],
        "longitude": e["longitude"],
        "url": e["url"][:500],
        "image": (e["image"] or "")[:500],
        "project_id": e["project_id"],
        "category": e["category"][:200],
    }


def sync_events(events=None):
    """Enregistre les événements Zetkin en base : ajoute les nouveaux, ne réécrit un événement déjà connu
    que si une de ses données a changé dans Zetkin, supprime les événements à venir qui ont disparu.
    Renvoie le nombre d'ajouts, de mises à jour, d'événements inchangés et de suppressions."""
    if events is None:
        events = fetch_public_events()
    now = timezone.now()
    created = updated = unchanged = 0
    with transaction.atomic():
        known = ZetkinEvent.objects.select_for_update().in_bulk([e["id"] for e in events], field_name="zetkin_id")
        for e in events:
            fields = _fields(e)
            event = known.get(e["id"])
            if event is None:
                ZetkinEvent.objects.create(zetkin_id=e["id"], updated_at=now, synced_at=now, **fields)
                created += 1
                continue
            changed = [name for name, value in fields.items() if getattr(event, name) != value]
            if changed:
                for name in changed:
                    setattr(event, name, fields[name])
                event.updated_at = now
                event.save(update_fields=[*changed, "updated_at"])
                logger.info("Événement Zetkin %s modifié : %s", e["id"], ", ".join(changed))
                updated += 1
            else:
                unchanged += 1
        # Tous les événements encore présents dans Zetkin : vus à cette synchro
        ZetkinEvent.objects.filter(zetkin_id__in=[e["id"] for e in events]).update(synced_at=now)
        deleted, _ = (ZetkinEvent.objects.upcoming()
                      .exclude(zetkin_id__in=[e["id"] for e in events])
                      .delete())
    return {"created": created, "updated": updated, "unchanged": unchanged, "deleted": deleted}


@shared_task(autoretry_for=(Exception,), retry_backoff=60, max_retries=3)
def sync_zetkin_events():
    result = sync_events()
    logger.info("Agenda Zetkin synchronisé : %(created)s ajoutés, %(updated)s mis à jour, "
                "%(unchanged)s inchangés, %(deleted)s supprimés", result)
    return result


@shared_task(autoretry_for=(Exception,), retry_backoff=60, max_retries=3)
def sync_supporters_count():
    count = SupportersCount.objects.create(count=fetch_supporters_count()).count
    logger.info("Nombre de soutiens relevé : %s", count)
    return count
