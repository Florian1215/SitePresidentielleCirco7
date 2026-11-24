from django.db import migrations, models

OLD = "Animateur·ices"
NEW = "Membres"


def rename(apps, schema_editor, old=OLD, new=NEW):
    """Le rôle « Animateur·ice » s'appelle désormais « Membre » : le groupe Django est renommé (comptes et
    permissions conservés), ou fusionné si un groupe du nouveau nom existe déjà."""
    Group = apps.get_model("auth", "Group")
    src = Group.objects.filter(name=old).first()
    dst = Group.objects.filter(name=new).first()
    if src and not dst:
        src.name = new
        src.save(update_fields=["name"])
    elif src and dst:
        dst.permissions.add(*src.permissions.all())
        dst.user_set.add(*src.user_set.all())
        src.delete()


def restore(apps, schema_editor):
    rename(apps, schema_editor, old=NEW, new=OLD)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0030_action_group_short_description"),
    ]

    operations = [
        migrations.AlterField(
            model_name='actiongroup',
            name='description',
            field=models.TextField(blank=True, help_text='Deux ou trois phrases affichées en haut de la page du groupe (300 caractères au plus). Modifiable aussi par ses membres depuis le site.', max_length=300, verbose_name='présentation'),
        ),
        migrations.RunPython(rename, restore),
    ]
