from django.core.management.base import BaseCommand

from core.action_populaire import fetch_supporters_count
from core.models import SupportersCount


class Command(BaseCommand):
    help = "Relève tout de suite le nombre de soutiens (sans attendre la tâche Celery horaire)."

    def handle(self, *args, **options):
        count = SupportersCount.objects.create(count=fetch_supporters_count()).count
        self.stdout.write(self.style.SUCCESS(f"Nombre de soutiens : {count}"))
