from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0018_signup_form_default'),
    ]

    operations = [
        migrations.AlterField(
            model_name='signupform',
            name='city',
            field=models.CharField(blank=True, help_text='Nom de la ville, en toutes lettres (ex. Berlin). Laisser vide pour le formulaire par défaut (autre ville, ou ville sans formulaire).', max_length=40, unique=True, verbose_name='ville'),
        ),
    ]
