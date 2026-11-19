from django.conf import settings
from django.db import models

from .zetkin import CITIES, nearest_city

# Pays de la 7e circonscription des Français établis hors de France
COUNTRIES = [
    ("DE", "Allemagne"),
    ("AL", "Albanie"),
    ("AT", "Autriche"),
    ("BA", "Bosnie-Herzégovine"),
    ("BG", "Bulgarie"),
    ("HR", "Croatie"),
    ("HU", "Hongrie"),
    ("MK", "Macédoine du Nord"),
    ("ME", "Monténégro"),
    ("PL", "Pologne"),
    ("RO", "Roumanie"),
    ("RS", "Serbie"),
    ("SK", "Slovaquie"),
    ("SI", "Slovénie"),
    ("CZ", "Tchéquie"),
    ("XK", "Kosovo"),
    ("XX", "Autre pays"),
]


#: Villes reconnues dans l'agenda Zetkin (un calendrier par ville).
AGENDA_CITY_CHOICES = sorted(((name, name) for name in CITIES), key=lambda c: c[0])


class FriendSite(models.Model):
    """Lien affiché dans la colonne « Sites amis » du pied de page."""

    name = models.CharField("nom", max_length=80)
    url = models.URLField("adresse")
    order = models.PositiveSmallIntegerField("ordre", default=0, help_text="Les plus petits nombres s'affichent en premier.")
    is_active = models.BooleanField("affiché", default=True)

    class Meta:
        verbose_name = "site ami"
        verbose_name_plural = "sites amis"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class SocialLink(models.Model):
    """Compte de réseau social affiché dans le bandeau « Suivez-nous » du pied de page."""

    NETWORKS = [
        ("bluesky", "Bluesky"),
        ("discord", "Discord"),
        ("facebook", "Facebook"),
        ("instagram", "Instagram"),
        ("linkedin", "LinkedIn"),
        ("mastodon", "Mastodon"),
        ("telegram", "Telegram"),
        ("threads", "Threads"),
        ("tiktok", "TikTok"),
        ("twitch", "Twitch"),
        ("whatsapp", "WhatsApp"),
        ("x", "X (Twitter)"),
        ("youtube", "YouTube"),
        ("other", "Autre"),
    ]

    network = models.CharField("réseau", max_length=20, choices=NETWORKS)
    url = models.URLField("adresse du compte")
    order = models.PositiveSmallIntegerField("ordre", default=0, help_text="Les plus petits nombres s'affichent en premier.")
    is_active = models.BooleanField("affiché", default=True)

    class Meta:
        verbose_name = "réseau social"
        verbose_name_plural = "réseaux sociaux"
        ordering = ["order", "network"]

    def __str__(self):
        return self.get_network_display()


class ActionGroup(models.Model):
    """Groupe d'action insoumis affiché sur la carte de la page « La circonscription »."""

    name = models.CharField("nom", max_length=200)
    city = models.CharField("ville", max_length=120, blank=True)
    country = models.CharField("pays", max_length=2, choices=[c for c in COUNTRIES if c[0] != "XX"])
    latitude = models.FloatField("latitude")
    longitude = models.FloatField("longitude")
    url = models.URLField("lien Action populaire")
    agenda_city = models.CharField(
        "ville de l'agenda", max_length=40, blank=True, choices=AGENDA_CITY_CHOICES,
        help_text="Calendrier proposé aux abonné·es de ce groupe. Vide : la ville la plus proche de sa position sur la carte.",
    )
    ap_id = models.UUIDField(
        "identifiant Action populaire", unique=True, null=True, blank=True,
        help_text="Rempli par l'import automatique ; laisser vide pour un groupe ajouté à la main.",
    )
    is_active = models.BooleanField("affiché sur la carte", default=True)
    updated_at = models.DateTimeField("mis à jour le", auto_now=True)

    class Meta:
        verbose_name = "groupe d'action"
        verbose_name_plural = "groupes d'action"
        ordering = ["country", "name"]

    def __str__(self):
        return self.name

    @property
    def calendar_city(self):
        """Ville de l'agenda auquel s'abonner pour suivre ce groupe (None si aucune ville connue à proximité)."""
        return self.agenda_city or nearest_city(self.latitude, self.longitude)



class ActionGroupLink(models.Model):
    """Réseau social d'un groupe d'action (Instagram, Facebook…), affiché dans la liste des groupes."""

    group = models.ForeignKey(ActionGroup, verbose_name="groupe", on_delete=models.CASCADE, related_name="links")
    network = models.CharField("réseau", max_length=20, choices=SocialLink.NETWORKS)
    url = models.URLField("adresse du compte")
    order = models.PositiveSmallIntegerField("ordre", default=0)

    class Meta:
        verbose_name = "réseau social du groupe"
        verbose_name_plural = "réseaux sociaux du groupe"
        ordering = ["order", "network"]

    def __str__(self):
        return f"{self.get_network_display()} — {self.group}"

class PollingStation(models.Model):
    """Bureau de vote affiché sur la carte de la page « Voter » (adresses fixées par arrêté avant chaque scrutin)."""

    name = models.CharField("nom", max_length=200, help_text="Ex. « Consulat général de France à Munich ».")
    address = models.TextField("adresse", blank=True, help_text="Adresse postale complète, sur une ou plusieurs lignes.")
    city = models.CharField("ville", max_length=120)
    country = models.CharField("pays", max_length=2, choices=[c for c in COUNTRIES if c[0] != "XX"])
    latitude = models.FloatField("latitude")
    longitude = models.FloatField("longitude")
    info = models.CharField(
        "informations pratiques", max_length=300, blank=True,
        help_text="Facultatif : horaires, accès, bureaux rattachés…",
    )
    url = models.URLField(
        "lien", blank=True,
        help_text="Facultatif : page du consulat. Par défaut, le point ouvre le plan (OpenStreetMap).",
    )
    is_active = models.BooleanField("affiché sur la carte", default=True)
    updated_at = models.DateTimeField("mis à jour le", auto_now=True)

    class Meta:
        verbose_name = "bureau de vote"
        verbose_name_plural = "bureaux de vote"
        ordering = ["country", "city", "name"]

    def __str__(self):
        return f"{self.name} ({self.city})"


class FaqEntry(models.Model):
    """Question fréquente de la page « Voter » (modifiable uniquement dans l'admin)."""

    question_fr = models.CharField("question (français)", max_length=300)
    answer_fr = models.TextField("réponse (français)")
    question_en = models.CharField(
        "question (anglais)", max_length=300, blank=True,
        help_text="Facultatif : à défaut, la version française s'affiche.",
    )
    answer_en = models.TextField("réponse (anglais)", blank=True)
    question_de = models.CharField(
        "question (allemand)", max_length=300, blank=True,
        help_text="Facultatif : à défaut, la version française s'affiche.",
    )
    answer_de = models.TextField("réponse (allemand)", blank=True)
    order = models.PositiveSmallIntegerField("ordre", default=0, help_text="Les plus petits nombres s'affichent en premier.")
    is_active = models.BooleanField("affichée", default=True)

    class Meta:
        verbose_name = "question fréquente"
        verbose_name_plural = "questions fréquentes"
        ordering = ["order", "id"]
    def __str__(self):
        return self.question_fr


class SignupForm(models.Model):
    """Formulaire Zetkin vers lequel le bouton « Je m'engage » (page « Je soutiens ») envoie les personnes d'une ville.
    La ligne « Par défaut » (ville vide) sert pour « Autre ville » et pour les villes sans formulaire."""

    DEFAULT = ""
    city = models.CharField(
        "ville", max_length=40, unique=True, blank=True,
        choices=[(DEFAULT, "Par défaut (autre ville, ou ville sans formulaire)"), *AGENDA_CITY_CHOICES],
    )
    url = models.URLField("formulaire Zetkin", help_text="Ex. https://app.zetkin.org/o/1030/surveys/1234")

    class Meta:
        verbose_name = "formulaire « Je m'engage »"
        verbose_name_plural = "formulaires « Je m'engage »"
        ordering = ["city"]

    def __str__(self):
        return self.city or "Par défaut"


TRACKER_LANGS = [("fr", "français"), ("en", "anglais"), ("de", "allemand")]


class Tracker(models.Model):
    """Lien de suivi (affiche, tract, réseau social…) : compte les visites arrivées par ce lien, par langue."""

    name = models.CharField("nom", max_length=120)
    code = models.CharField("identifiant", max_length=16, unique=True)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="créé par", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        verbose_name = "tracker"
        verbose_name_plural = "trackers"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Visit(models.Model):
    """Une arrivée sur le site : par un lien de suivi (tracker) ou non, avec la langue et l'origine (Google, ChatGPT…)."""

    tracker = models.ForeignKey(
        Tracker, verbose_name="tracker", null=True, blank=True, on_delete=models.CASCADE, related_name="visits"
    )
    lang = models.CharField("langue", max_length=2, choices=TRACKER_LANGS)
    source = models.CharField("origine", max_length=60, blank=True, help_text="Vide : accès direct (adresse tapée, favori, QR code…).")
    referrer_host = models.CharField("site d'origine", max_length=255, blank=True)
    created_at = models.DateTimeField("le", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "visite"
        verbose_name_plural = "visites"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} · {self.source or 'direct'}"
