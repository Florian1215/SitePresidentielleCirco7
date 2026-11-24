from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0027_action_group_page"),
    ]

    operations = [
        migrations.AddField(
            model_name="actiongroup",
            name="logo",
            field=models.ImageField(
                blank=True, upload_to="groupes/logos/", verbose_name="logo",
                help_text="Affiché sur la page du groupe et en haut de ses QR codes « sticker ». PNG transparent de préférence.",
            ),
        ),
    ]
