from django.db import migrations

WRITERS = "Rédacteur·ices"


def grant(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    group, _ = Group.objects.get_or_create(name=WRITERS)
    group.permissions.add(*Permission.objects.filter(content_type__app_label="blog", codename="add_category"))


def revoke(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    group = Group.objects.filter(name=WRITERS).first()
    if group:
        group.permissions.remove(*Permission.objects.filter(content_type__app_label="blog", codename="add_category"))


class Migration(migrations.Migration):
    """Les rédacteur·ices peuvent créer une catégorie depuis la page Articles."""

    dependencies = [("blog", "0004_markdown_to_html")]

    operations = [migrations.RunPython(grant, revoke)]
