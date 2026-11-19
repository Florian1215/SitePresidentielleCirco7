import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_remove_contactmessage'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Tracker',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, verbose_name='nom')),
                ('code', models.CharField(max_length=16, unique=True, verbose_name='identifiant')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='créé le')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL, verbose_name='créé par')),
            ],
            options={
                'verbose_name': 'tracker',
                'verbose_name_plural': 'trackers',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='TrackerVisit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('lang', models.CharField(choices=[('fr', 'français'), ('en', 'anglais'), ('de', 'allemand')], max_length=2, verbose_name='langue du lien')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='le')),
                ('tracker', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='visits', to='core.tracker', verbose_name='tracker')),
            ],
            options={
                'verbose_name': 'visite',
                'verbose_name_plural': 'visites',
                'ordering': ['-created_at'],
            },
        ),
    ]
