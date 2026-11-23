"""Celery : tâches de fond (broker Redis), lancées par le service « celery » des docker-compose.

    celery -A config worker --beat   → exécute les tâches et les planifie (settings.CELERY_BEAT_SCHEDULE)
"""
import os

from celery import Celery
from celery.signals import worker_ready

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@worker_ready.connect
def sync_on_startup(sender, **kwargs):
    """Données à jour dès le démarrage, sans attendre l'heure pile."""
    sender.app.send_task("core.tasks.sync_zetkin_events")
    sender.app.send_task("core.tasks.sync_supporters_count")
