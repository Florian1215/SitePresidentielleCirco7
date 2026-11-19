"""Les visites de trackers deviennent les visites de tout le site (tracker facultatif, origine Google / ChatGPT…)."""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0014_trackers'),
    ]

    operations = [
        migrations.RenameModel(old_name='TrackerVisit', new_name='Visit'),
        migrations.AlterField(
            model_name='visit',
            name='tracker',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='visits', to='core.tracker', verbose_name='tracker'),
        ),
        migrations.AlterField(
            model_name='visit',
            name='lang',
            field=models.CharField(choices=[('fr', 'français'), ('en', 'anglais'), ('de', 'allemand')], max_length=2, verbose_name='langue'),
        ),
        migrations.AddField(
            model_name='visit',
            name='source',
            field=models.CharField(blank=True, help_text='Vide : accès direct (adresse tapée, favori, QR code…).', max_length=60, verbose_name='origine'),
        ),
        migrations.AddField(
            model_name='visit',
            name='referrer_host',
            field=models.CharField(blank=True, max_length=255, verbose_name="site d'origine"),
        ),
    ]
