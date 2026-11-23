"""Tâches Celery de l'app core (worker et planificateur : service « celery » des docker-compose).

sync_zetkin_events, toutes les heures (settings.CELERY_BEAT_SCHEDULE) et au démarrage du worker :
copie dans la table ZetkinEvent les événements des projets publics du calendrier Zetkin.
  - nouvel événement            → ajouté
  - événement modifié           → mis à jour (même identifiant Zetkin)
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


def sync_events(events=None):
    """Enregistre les événements Zetkin en base. Renvoie le nombre d'ajouts, de mises à jour et de suppressions."""
    if events is None:
        events = fetch_public_events()
    created = updated = 0
    with transaction.atomic():
        for e in events:
            _, was_created = ZetkinEvent.objects.update_or_create(
                zetkin_id=e["id"],
                defaults={
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
                },
            )
            created += was_created
            updated += not was_created
        deleted, _ = (ZetkinEvent.objects.upcoming()
                      .exclude(zetkin_id__in=[e["id"] for e in events])
                      .delete())
    return {"created": created, "updated": updated, "deleted": deleted}


@shared_task(autoretry_for=(Exception,), retry_backoff=60, max_retries=3)
def sync_zetkin_events():
    result = sync_events()
    logger.info("Agenda Zetkin synchronisé : %(created)s ajoutés, %(updated)s mis à jour, %(deleted)s supprimés", result)
    return result


@shared_task(autoretry_for=(Exception,), retry_backoff=60, max_retries=3)
def sync_supporters_count():
    count = SupportersCount.objects.create(count=fetch_supporters_count()).count
    logger.info("Nombre de soutiens relevé : %s", count)
    return count
