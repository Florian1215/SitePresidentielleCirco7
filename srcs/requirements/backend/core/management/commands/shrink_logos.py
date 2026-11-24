import os

from django.core.management.base import BaseCommand

from blog.images import shrink_logo
from core.models import ActionGroup


class Command(BaseCommand):
    help = (
        "Recadre (marges transparentes ou de couleur unie) et compresse les logos des groupes d'action déjà envoyés, "
        "comme le fait désormais l'envoi d'un logo."
    )

    def handle(self, *args, **options):
        for group in ActionGroup.objects.exclude(logo=""):
            old = group.logo.name
            try:
                with group.logo.open("rb") as f:
                    before = group.logo.size
                    content = shrink_logo(f)
            except (OSError, ValueError) as exc:
                self.stderr.write(f"{group.name} : logo illisible ({exc})")
                continue
            if content.size == before and os.path.basename(old) == content.name:
                self.stdout.write(f"{group.name} : inchangé")
                continue
            group.logo.save(content.name, content, save=False)
            group.save(update_fields=["logo", "updated_at"])
            if old != group.logo.name:
                group.logo.storage.delete(old)
            self.stdout.write(f"{group.name} : {before // 1024} Ko → {content.size // 1024} Ko")
