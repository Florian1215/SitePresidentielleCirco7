from django.db import migrations

# Groupes d'action de la circonscription présents sur Action populaire le 11 novembre 2026.
# Pour les mettre à jour : python manage.py import_action_groups
# (identifiant Action populaire, nom, ville, pays, latitude, longitude)
GROUPS = [
    ('cf56c187-62e3-4dc9-8f7a-f8c929699c25', 'GA Linz insoumise', '', 'AT', 48.28868, 14.30023),
    ('273a9f6f-00ec-4fc4-a031-ba2b5654e569', 'Graz Insoumise', '', 'AT', 47.0707, 15.43849),
    ('7939e19c-34d3-4310-a06b-b327833037a1', 'Équipe de soutien Vienne, Autriche', 'Wien', 'AT', 48.21235, 16.3304),
    ('5a25e25c-62e4-4db7-a0c1-c5f2934f3520', "Groupe d'action Prague", '', 'CZ', 50.0753, 14.43908),
    ('3db3e34b-d05e-436a-bc64-de64aa87cd0f', 'Berlin Insoumise', 'Berlin', 'DE', 52.48629, 13.42455),
    ('320b3e48-794f-42ee-ba69-3e2dc8f990aa', 'Brême Insoumise', 'Brême', 'DE', 53.0833, 8.81376),
    ('518a983b-7321-40dd-9175-39e3146f3675', 'Darmstadt Insoumise', 'Darmstadt', 'DE', 49.85752, 8.63897),
    ('b39c8e89-70a6-4b06-b626-c8ea2aabe90c', 'FI canal historique', '', 'DE', 52.52054, 13.39103),
    ('d69fbe1c-1d95-4024-b140-d594ff6732ea', 'FP Mannheim-Heidelberg', '', 'DE', 49.48722, 8.4663),
    ('d4d16e4e-6ae5-423e-ba1f-12ecee9c011b', 'Francfort insoumise', '', 'DE', 50.11057, 8.68161),
    ('d4818b39-f830-4781-8cd3-bf8b6263db00', 'GA Dresden', '', 'DE', 51.04811, 13.74015),
    ('0f6f4cae-943d-43eb-92f8-eeb29a1315fa', 'GA de Leipzig', 'Leipzig', 'DE', 51.37403, 12.43406),
    ('eaeff739-bed9-486c-9699-69d4dc1f770b', 'Groupe LFI Sarrebruck', 'BREBACH', 'DE', 49.21536, 7.03062),
    ('f5d699df-98c6-4432-ab8e-4743f0c20f76', "Groupe d'action Berlin-Nord", 'Berlin', 'DE', 52.55259, 13.43059),
    ('3a95566f-d1fd-4bc3-b893-97afd98d7394', "Groupe d'action de Freiburg", 'Freiburg', 'DE', 47.98607, 7.84513),
    ('6b74a59c-a022-40f9-a729-9469aba5a819', "Groupe d'action de Karlsruhe", '', 'DE', 49.00688, 8.40365),
    ('34c4bc6e-6306-4dc6-8717-3e3930c4eb24', "Groupe d'action de Stuttgart", 'Stuttgart', 'DE', 48.77297, 9.17715),
    ('8d1762ff-d3d7-4605-a2cc-73434a7cd47f', 'Groupe d’action à Tübingen', '', 'DE', 48.52207, 9.05798),
    ('634e4099-5df0-44c3-a47e-f2d6a363568d', 'Hambourg insoumise', 'Hamburg', 'DE', 53.55086, 9.99289),
    ('4b707a8c-cb65-4015-ab1b-f17fd78cfeab', 'Hanovre Insoumise', '', 'DE', 52.36536, 9.73499),
    ('0e40c669-4f5d-4052-8ec0-cd164c37e217', 'Kiel insoumise', '', 'DE', 54.33528, 10.12768),
    ('f20c4256-cfd2-43a8-a34c-e70dd64aba04', 'LFi_GA-Bonn', '', 'DE', 50.74294, 7.0983),
    ('6ad921bc-e880-4cff-a194-423686048b4b', 'Les Insoumis.es NRW Nord', 'Bielefeld', 'DE', 52.0291, 8.53304),
    ('ae964c7e-8a41-48e1-844d-1d43a860d4b0', 'Les Insoumis·es NRW', 'Düsseldorf', 'DE', 51.22159, 6.77283),
    ('dffa34f6-960b-4ae1-b0b0-552d164b42e0', 'Les insoumis·es de Munich', 'München', 'DE', 48.11847, 11.58153),
    ('86cbee58-acd4-4014-8ef2-fcdd99d0ffa7', 'Nuremberg insoumise', '', 'DE', 49.45439, 11.07417),
    ('95a0c8ac-8762-4035-8425-3bcc96d4399b', 'Union Populaire Sarrebruck', '', 'DE', 49.23184, 6.96268),
    ('7b4fc77b-6729-48c6-bb97-6036c6876858', 'Le Nouveau Front Populaire Hongrie', '', 'HU', 47.34036, 19.43854),
    ('d4bf6230-cf39-42b1-b702-954e0f14a43c', 'Action Populaire Varsovie', '', 'PL', 52.2323, 21.00587),
    ('71e03a00-11bd-459d-ad1b-5802e3ba3674', 'LFI Cracovie', '', 'PL', 50.05196, 19.94535),
    ('0fd271ca-1a62-40a0-9d35-a1595ff50b91', "Groupe d'action de Bucarest", '', 'RO', 44.4319, 26.10662),
    ('4d453f43-0458-4a16-aae5-a8291be7f5db', 'Insoumis·es de Roumanie & Moldavie', '', 'RO', 44.45798, 26.10698),
    ('8be8d727-47d0-4d7b-8d69-df2066275fb1', "Groupe d'action Serbie insoumise", '', 'RS', 44.77598, 20.49696),
]


def create_groups(apps, schema_editor):
    ActionGroup = apps.get_model("core", "ActionGroup")
    for ap_id, name, city, country, lat, lon in GROUPS:
        ActionGroup.objects.get_or_create(
            ap_id=ap_id,
            defaults={
                "name": name, "city": city, "country": country, "latitude": lat, "longitude": lon,
                "url": f"https://actionpopulaire.fr/groupes/{ap_id}/",
            },
        )


def delete_groups(apps, schema_editor):
    apps.get_model("core", "ActionGroup").objects.filter(ap_id__in=[g[0] for g in GROUPS]).delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0004_action_groups_kosovo")]

    operations = [migrations.RunPython(create_groups, delete_groups)]
