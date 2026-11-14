from django.db import migrations

# Brouillons des bureaux de vote : un par poste consulaire de la circonscription, MASQUÉS sur le site.
# Les bureaux de vote de la présidentielle 2027 (et leurs adresses) sont fixés par arrêté quelques mois avant
# le scrutin : il suffira alors de compléter le nom et l'adresse dans l'admin, de corriger la position,
# puis de cocher « affiché sur la carte ». Positions = centre de la ville, à préciser.
# (ville, pays, latitude, longitude)
POSTS = [
    ("Berlin", "DE", 52.5200, 13.4050),
    ("Bonn", "DE", 50.7374, 7.0982),
    ("Düsseldorf", "DE", 51.2277, 6.7735),
    ("Francfort", "DE", 50.1109, 8.6821),
    ("Hambourg", "DE", 53.5511, 9.9937),
    ("Munich", "DE", 48.1351, 11.5820),
    ("Sarrebruck", "DE", 49.2402, 6.9969),
    ("Stuttgart", "DE", 48.7758, 9.1829),
    ("Vienne", "AT", 48.2082, 16.3738),
    ("Varsovie", "PL", 52.2297, 21.0122),
    ("Cracovie", "PL", 50.0647, 19.9450),
    ("Prague", "CZ", 50.0755, 14.4378),
    ("Bucarest", "RO", 44.4268, 26.1025),
    ("Budapest", "HU", 47.4979, 19.0402),
    ("Belgrade", "RS", 44.7866, 20.4489),
    ("Sofia", "BG", 42.6977, 23.3219),
    ("Zagreb", "HR", 45.8150, 15.9819),
    ("Bratislava", "SK", 48.1486, 17.1077),
    ("Ljubljana", "SI", 46.0569, 14.5058),
    ("Sarajevo", "BA", 43.8563, 18.4131),
    ("Skopje", "MK", 41.9981, 21.4254),
    ("Tirana", "AL", 41.3275, 19.8187),
    ("Podgorica", "ME", 42.4304, 19.2594),
    ("Pristina", "XK", 42.6629, 21.1655),
]

DRAFT_NAME = "Bureau de vote de {city} (à compléter)"


def create_drafts(apps, schema_editor):
    PollingStation = apps.get_model("core", "PollingStation")
    for city, country, lat, lon in POSTS:
        PollingStation.objects.get_or_create(
            name=DRAFT_NAME.format(city=city),
            defaults={"city": city, "country": country, "latitude": lat, "longitude": lon, "is_active": False},
        )


def delete_drafts(apps, schema_editor):
    PollingStation = apps.get_model("core", "PollingStation")
    PollingStation.objects.filter(name__in=[DRAFT_NAME.format(city=p[0]) for p in POSTS], is_active=False).delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0006_polling_stations")]

    operations = [migrations.RunPython(create_drafts, delete_drafts)]
