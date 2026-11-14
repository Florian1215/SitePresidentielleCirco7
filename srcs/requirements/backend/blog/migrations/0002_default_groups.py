from django.contrib.auth.management import create_permissions
from django.db import migrations

GROUPS = {
    "Rédacteur·ices": [
        "add_article", "change_article", "delete_article", "view_article",
        "view_category",
    ],
    "Éditeur·ices": [
        "add_article", "change_article", "delete_article", "view_article",
        "publish_article", "manage_all_articles",
        "add_category", "change_category", "delete_category", "view_category",
    ],
}


def create_groups(apps, schema_editor):
    # Les permissions sont normalement créées après les migrations : on force leur création ici.
    for app_config in apps.get_app_configs():
        app_config.models_module = True
        create_permissions(app_config, apps=apps, verbosity=0)
        app_config.models_module = None

    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    for name, codenames in GROUPS.items():
        group, _ = Group.objects.get_or_create(name=name)
        perms = Permission.objects.filter(content_type__app_label="blog", codename__in=codenames)
        group.permissions.add(*perms)


def remove_groups(apps, schema_editor):
    apps.get_model("auth", "Group").objects.filter(name__in=GROUPS).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [migrations.RunPython(create_groups, remove_groups)]
