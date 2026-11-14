from django.db import migrations

# Les liens qui étaient écrits en dur dans le pied de page ; modifiables ensuite dans l'admin.
DEFAULT_SITES = [
    ("Mélenchon 2027", "https://melenchon2027.fr/"),
    ("La France insoumise", "https://lafranceinsoumise.fr/"),
    ("Action populaire", "https://actionpopulaire.fr/"),
]


def create_sites(apps, schema_editor):
    FriendSite = apps.get_model("core", "FriendSite")
    if FriendSite.objects.exists():
        return
    for order, (name, url) in enumerate(DEFAULT_SITES, start=1):
        FriendSite.objects.create(name=name, url=url, order=order * 10)


def delete_sites(apps, schema_editor):
    FriendSite = apps.get_model("core", "FriendSite")
    FriendSite.objects.filter(url__in=[url for _, url in DEFAULT_SITES]).delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0002_footer_links")]

    operations = [migrations.RunPython(create_sites, delete_sites)]
