from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0028_action_group_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="actiongroup",
            name="cover",
            field=models.ImageField(
                blank=True, upload_to="groupes/couvertures/", verbose_name="image d'en-tête",
                help_text="Grande image en haut de la page du groupe (format paysage, 1600 px de large ou plus).",
            ),
        ),
    ]
