from django.core.management.base import BaseCommand
from django.db import transaction

from core.action_populaire import fetch_groups
from core.models import ActionGroup


class Command(BaseCommand):
    help = (
        "Importe ou met à jour les groupes d'action de la circonscription depuis Action populaire. "
        "Les groupes masqués dans l'admin restent masqués ; rien n'est supprimé."
    )

    def handle(self, *args, **options):
        groups = fetch_groups()
        created = updated = 0
        with transaction.atomic():
            for ap_id, data in groups.items():
                _, was_created = ActionGroup.objects.update_or_create(ap_id=ap_id, defaults=data)
                created += was_created
                updated += not was_created
        self.stdout.write(self.style.SUCCESS(
            f"{len(groups)} groupes trouvés sur Action populaire : {created} ajoutés, {updated} mis à jour."
        ))
