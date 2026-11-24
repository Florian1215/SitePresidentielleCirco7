from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

OLD = "Rédacteur·ices"
NEW = "Animateur·ices"


def rename_writers(apps, schema_editor):
    """Le rôle « Rédacteur·ice » devient « Animateur·ice de groupe d'action » : mêmes droits sur les articles, plus la
    modification de la page de son groupe. Le groupe Django est renommé : comptes et permissions sont conservés."""
    Group = apps.get_model("auth", "Group")
    old = Group.objects.filter(name=OLD).first()
    new = Group.objects.filter(name=NEW).first()
    if old and not new:
        old.name = NEW
        old.save(update_fields=["name"])
    elif old and new:
        new.permissions.add(*old.permissions.all())
        new.user_set.add(*old.user_set.all())
        old.delete()


def restore_writers(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    if not Group.objects.filter(name=OLD).exists():
        Group.objects.filter(name=NEW).update(name=OLD)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0026_zetkin_event_updated_at"),
        # Le groupe « Rédacteur·ices » et ses permissions sont créés par les migrations du blog
        ("blog", "0009_review_comments"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="actiongroup",
            name="description",
            field=models.TextField(
                blank=True, max_length=2000, verbose_name="présentation",
                help_text="Quelques lignes affichées sur la page du groupe. Modifiable aussi par ses animateur·ices depuis le site.",
            ),
        ),
        migrations.CreateModel(
            name="ActionGroupPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="groupes/%Y/%m/", verbose_name="photo")),
                ("caption", models.CharField(blank=True, max_length=200, verbose_name="légende")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="ajoutée le")),
                ("group", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="photos", to="core.actiongroup", verbose_name="groupe")),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL, verbose_name="ajoutée par")),
            ],
            options={
                "verbose_name": "photo du groupe",
                "verbose_name_plural": "photos du groupe",
                "ordering": ["-created_at"],
            },
        ),
        migrations.RunPython(rename_writers, restore_writers),
    ]
