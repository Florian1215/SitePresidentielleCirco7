from django.db import migrations

MEMBERS = "Membres"
MANAGERS = "Gestionnaires de GA"


def create_managers(apps, schema_editor):
    """Rôle « Gestionnaire du GA » : les mêmes permissions que les membres (articles) ; la gestion des demandes de
    compte de son groupe est accordée par le code du site, pas par une permission Django."""
    Group = apps.get_model("auth", "Group")
    managers, _ = Group.objects.get_or_create(name=MANAGERS)
    members = Group.objects.filter(name=MEMBERS).first()
    if members:
        managers.permissions.add(*members.permissions.all())


def remove_managers(apps, schema_editor):
    apps.get_model("auth", "Group").objects.filter(name=MANAGERS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0033_group_visits"),
    ]

    operations = [
        migrations.RunPython(create_managers, remove_managers),
    ]
