from django.core.management.base import BaseCommand

from core.tasks import sync_events


class Command(BaseCommand):
    help = "Synchronise tout de suite l'agenda avec Zetkin (sans attendre la tâche Celery horaire)."

    def handle(self, *args, **options):
        r = sync_events()
        self.stdout.write(self.style.SUCCESS(
            f"Agenda Zetkin : {r['created']} ajoutés, {r['updated']} mis à jour, {r['unchanged']} inchangés, {r['deleted']} supprimés."
        ))
