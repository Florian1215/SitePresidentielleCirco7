# Questions fréquentes de la page « Voter », reprises des textes du site (fr, en, de) au 17 novembre 2026.
from django.db import migrations

FAQ = [
    {
        "question_fr": "Je suis inscrit·e au Registre des Français·es de l'étranger, suis-je inscrit·e pour voter ?",
        "answer_fr": "Pas forcément. L'inscription au Registre (auprès du consulat) et l'inscription sur la liste électorale consulaire sont deux démarches distinctes, même si elles sont souvent faites en même temps. Vérifiez votre situation électorale en ligne pour en être sûr·e.",
        "question_en": "I am on the Register of French citizens abroad. Am I registered to vote?",
        "answer_en": "Not necessarily. Registering with the consulate (the “Registre”) and registering on the consular electoral roll are two separate steps, even though they are often done at the same time. Check your electoral status online to be sure.",
        "question_de": "Ich bin im Register der Französinnen und Franzosen im Ausland eingetragen. Bin ich damit wahlberechtigt eingetragen?",
        "answer_de": "Nicht unbedingt. Die Eintragung im Register (beim Konsulat) und die Eintragung in die konsularische Wählerliste sind zwei verschiedene Schritte, auch wenn sie oft gleichzeitig erfolgen. Prüfen Sie Ihren Wahlstatus online, um sicher zu sein.",
        "order": 10
    },
    {
        "question_fr": "Puis-je rester inscrit·e dans ma commune en France ?",
        "answer_fr": "Depuis 2019, on ne peut être inscrit·e que sur une seule liste : soit la liste électorale consulaire (vous votez à l'étranger, et pour la ou le député·e des Français·es de l'étranger aux législatives), soit la liste d'une commune française (vous votez en France, en personne ou par procuration). S'inscrire sur la liste consulaire vous radie automatiquement de votre commune.",
        "question_en": "Can I stay registered in my municipality in France?",
        "answer_en": "Since 2019, you can only be on one roll: either the consular electoral roll (you vote abroad, and in legislative elections for the member of parliament for French citizens abroad) or the roll of a French municipality (you vote in France, in person or by proxy). Registering on the consular roll automatically removes you from your municipality’s roll.",
        "question_de": "Kann ich in meiner Gemeinde in Frankreich eingetragen bleiben?",
        "answer_de": "Seit 2019 kann man nur in einer einzigen Liste eingetragen sein: entweder in der konsularischen Wählerliste (Sie wählen im Ausland und bei Parlamentswahlen die Abgeordnete bzw. den Abgeordneten der Französinnen und Franzosen im Ausland) oder in der Liste einer französischen Gemeinde (Sie wählen in Frankreich, persönlich oder per Vollmacht). Mit der Eintragung in die konsularische Liste werden Sie automatisch aus der Liste Ihrer Gemeinde gestrichen.",
        "order": 20
    },
    {
        "question_fr": "Peut-on voter par internet à la présidentielle ?",
        "answer_fr": "Non. Le vote par internet existe pour les législatives et les élections consulaires, mais pas pour l'élection présidentielle. Il faut voter à l'urne dans votre bureau de vote à l'étranger, ou donner procuration.",
        "question_en": "Can I vote online in the presidential election?",
        "answer_en": "No. Online voting exists for legislative and consular elections, but not for the presidential election. You must vote in person at your polling station abroad, or give a proxy.",
        "question_de": "Kann man bei der Präsidentschaftswahl online wählen?",
        "answer_de": "Nein. Online-Wahlen gibt es bei Parlaments- und Konsularwahlen, aber nicht bei der Präsidentschaftswahl. Sie müssen in Ihrem Wahllokal im Ausland persönlich wählen oder eine Vollmacht erteilen.",
        "order": 30
    },
    {
        "question_fr": "Je ne pourrai pas me déplacer le jour du vote, comment faire ?",
        "answer_fr": "Donnez procuration à une personne de confiance inscrite sur les listes électorales. Action populaire (actionpopulaire.fr/procuration) vous met en relation avec une personne pour porter votre voix et vous guide dans la démarche officielle : demande sur maprocuration.gouv.fr, puis vérification de votre identité au consulat (ou dans un commissariat/gendarmerie si vous êtes en France). Faites-le le plus tôt possible : la procuration doit être parvenue au bureau de vote avant le scrutin.",
        "question_en": "I won’t be able to go and vote on election day. What can I do?",
        "answer_en": "Give a proxy to a trusted person who is registered to vote. Action populaire (actionpopulaire.fr/procuration) puts you in touch with someone who can cast your vote and guides you through the official procedure: an application on maprocuration.gouv.fr, then an identity check at the consulate (or at a police or gendarmerie station if you are in France). Do it as early as possible: the proxy must reach the polling station before the vote.",
        "question_de": "Ich kann am Wahltag nicht ins Wahllokal kommen. Was kann ich tun?",
        "answer_de": "Erteilen Sie einer Vertrauensperson, die im Wählerverzeichnis eingetragen ist, eine Vollmacht. Action populaire (actionpopulaire.fr/procuration) vermittelt Ihnen eine Person, die für Sie abstimmt, und begleitet Sie durch das offizielle Verfahren: Antrag auf maprocuration.gouv.fr, danach Identitätsprüfung im Konsulat (oder bei Polizei bzw. Gendarmerie, wenn Sie in Frankreich sind). Tun Sie es so früh wie möglich: Die Vollmacht muss vor der Wahl im Wahllokal vorliegen.",
        "order": 40
    },
    {
        "question_fr": "Quels documents faut-il pour s'inscrire ?",
        "answer_fr": "Un justificatif d'identité et de nationalité française en cours de validité (carte d'identité ou passeport) et un justificatif de résidence dans la circonscription consulaire (contrat de location, facture, attestation d'inscription au Registre…). Tout se fait en ligne avec FranceConnect ou un compte service-public.",
        "question_en": "Which documents do I need to register?",
        "answer_en": "Valid proof of identity and French nationality (identity card or passport) and proof of residence in the consular district (rental contract, bill, certificate of registration with the consulate…). Everything is done online with FranceConnect or a service-public account.",
        "question_de": "Welche Unterlagen brauche ich für die Eintragung?",
        "answer_de": "Einen gültigen Nachweis Ihrer Identität und der französischen Staatsangehörigkeit (Personalausweis oder Reisepass) sowie einen Wohnsitznachweis im Konsularbezirk (Mietvertrag, Rechnung, Bescheinigung über die Eintragung im Register…). Alles geht online mit FranceConnect oder einem service-public-Konto.",
        "order": 50
    },
    {
        "question_fr": "Je viens de déménager dans un autre pays de la circonscription, que faire ?",
        "answer_fr": "Inscrivez-vous sur la liste électorale du consulat de votre nouveau pays de résidence : vous serez automatiquement radié·e de l'ancienne liste. Pensez aussi à mettre à jour votre inscription au Registre.",
        "question_en": "I have just moved to another country of the constituency. What should I do?",
        "answer_en": "Register on the electoral roll of the consulate in your new country of residence: you will automatically be removed from the previous roll. Remember to update your registration with the consulate (the “Registre”) as well.",
        "question_de": "Ich bin gerade in ein anderes Land des Wahlkreises umgezogen. Was muss ich tun?",
        "answer_de": "Tragen Sie sich in die Wählerliste des Konsulats Ihres neuen Wohnsitzlandes ein: Sie werden dann automatisch aus der alten Liste gestrichen. Denken Sie auch daran, Ihre Eintragung im Register zu aktualisieren.",
        "order": 60
    }
]


def create(apps, schema_editor):
    FaqEntry = apps.get_model("core", "FaqEntry")
    if not FaqEntry.objects.exists():
        FaqEntry.objects.bulk_create(FaqEntry(**row) for row in FAQ)


def remove(apps, schema_editor):
    apps.get_model("core", "FaqEntry").objects.filter(question_fr__in=[r["question_fr"] for r in FAQ]).delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0010_faq_entries")]

    operations = [migrations.RunPython(create, remove)]
