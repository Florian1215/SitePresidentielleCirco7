from django.db import models

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


class ContactMessage(models.Model):
    name = models.CharField("nom", max_length=120)
    email = models.EmailField("e-mail")
    country = models.CharField("pays", max_length=2, choices=COUNTRIES, blank=True)
    subject = models.CharField("objet", max_length=200)
    message = models.TextField("message")
    created_at = models.DateTimeField("reçu le", auto_now_add=True)
    handled = models.BooleanField("traité", default=False)

    class Meta:
        verbose_name = "message de contact"
        verbose_name_plural = "messages de contact"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.subject} — {self.name}"


class Supporter(models.Model):
    first_name = models.CharField("prénom", max_length=80)
    last_name = models.CharField("nom", max_length=80)
    email = models.EmailField("e-mail", unique=True)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    country = models.CharField("pays", max_length=2, choices=COUNTRIES)
    city = models.CharField("ville", max_length=120, blank=True)
    wants_registration_help = models.BooleanField("souhaite de l'aide pour s'inscrire sur les listes", default=False)
    wants_reminders = models.BooleanField("souhaite recevoir les rappels électoraux", default=True)
    wants_to_volunteer = models.BooleanField("souhaite participer à la campagne", default=False)
    consent = models.BooleanField("consentement RGPD")
    created_at = models.DateTimeField("inscrit·e le", auto_now_add=True)
    updated_at = models.DateTimeField("mis à jour le", auto_now=True)

    class Meta:
        verbose_name = "soutien"
        verbose_name_plural = "soutiens"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_country_display()})"


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
    label = models.CharField(
        "intitulé", max_length=80, blank=True,
        help_text="Facultatif : texte lu par les lecteurs d'écran (par défaut, le nom du réseau).",
    )
    order = models.PositiveSmallIntegerField("ordre", default=0, help_text="Les plus petits nombres s'affichent en premier.")
    is_active = models.BooleanField("affiché", default=True)

    class Meta:
        verbose_name = "réseau social"
        verbose_name_plural = "réseaux sociaux"
        ordering = ["order", "network"]

    def __str__(self):
        return self.label or self.get_network_display()


class ActionGroup(models.Model):
    """Groupe d'action insoumis affiché sur la carte de la page « La circonscription »."""

    name = models.CharField("nom", max_length=200)
    city = models.CharField("ville", max_length=120, blank=True)
    country = models.CharField("pays", max_length=2, choices=[c for c in COUNTRIES if c[0] != "XX"])
    latitude = models.FloatField("latitude")
    longitude = models.FloatField("longitude")
    url = models.URLField("lien Action populaire")
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
