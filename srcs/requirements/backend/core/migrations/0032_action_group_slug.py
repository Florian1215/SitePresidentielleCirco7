from django.db import migrations, models
from django.utils.text import slugify

HELP = (
    "/groupes/<adresse>. Créée à partir du nom, elle ne change pas si le groupe est renommé "
    "(les QR codes déjà imprimés restent valables). Laisser vide pour la recréer."
)


def fill_slugs(apps, schema_editor):
    """Adresse de la page de chaque groupe existant, tirée de son nom (doublons : -2, -3…)."""
    ActionGroup = apps.get_model("core", "ActionGroup")
    taken = set()
    for group in ActionGroup.objects.order_by("pk"):
        base = slugify(group.name)[:190] or "groupe"
        if base.isdigit():
            base = f"groupe-{base}"
        slug, n = base, 2
        while slug in taken:
            slug, n = f"{base}-{n}", n + 1
        taken.add(slug)
        group.slug = slug
        group.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0031_rename_animators_to_members"),
    ]

    operations = [
        migrations.AddField(
            model_name="actiongroup",
            name="slug",
            field=models.SlugField(blank=True, db_index=False, default="", max_length=200, verbose_name="adresse de la page", help_text=HELP),
            preserve_default=False,
        ),
        migrations.RunPython(fill_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="actiongroup",
            name="slug",
            field=models.SlugField(blank=True, max_length=200, unique=True, verbose_name="adresse de la page", help_text=HELP),
        ),
    ]
