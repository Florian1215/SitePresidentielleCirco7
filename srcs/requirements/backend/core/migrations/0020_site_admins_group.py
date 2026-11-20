from django.db import migrations

ADMINS_GROUP = "Administrateur·ices"


def create_group(apps, schema_editor):
    """Groupe des admins du site (droits : core.backends.SiteAdminBackend). Les super-utilisateur·ices existant·es y
    sont ajouté·es : ils et elles restent admins du site si on leur retire ensuite le statut staff / super-utilisateur·ice."""
    Group = apps.get_model("auth", "Group")
    User = apps.get_model("auth", "User")
    group, _ = Group.objects.get_or_create(name=ADMINS_GROUP)
    group.user_set.add(*User.objects.filter(is_superuser=True))


def remove_group(apps, schema_editor):
    apps.get_model("auth", "Group").objects.filter(name=ADMINS_GROUP).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_signup_form_free_city'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [migrations.RunPython(create_group, remove_group)]
