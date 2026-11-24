from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

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
        ("facebook", "Facebook"),
        ("instagram", "Instagram"),
        ("linktree", "Linktree"),
        ("telegram", "Telegram"),
        ("tiktok", "TikTok"),
        ("twitch", "Twitch"),
        ("whatsapp", "WhatsApp"),
        ("x", "X (Twitter)"),
        ("youtube", "YouTube"),
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
    slug = models.SlugField(
        "adresse de la page", max_length=200, unique=True, blank=True,
        help_text="/groupes/<adresse>. Créée à partir du nom, elle ne change pas si le groupe est renommé "
        "(les QR codes déjà imprimés restent valables). Laisser vide pour la recréer.",
    )
    city = models.CharField("ville", max_length=120, blank=True)
    country = models.CharField("pays", max_length=2, choices=[c for c in COUNTRIES if c[0] != "XX"])
    latitude = models.FloatField("latitude")
    longitude = models.FloatField("longitude")
    url = models.URLField("lien Action populaire")
    description = models.TextField(
        "présentation", blank=True, max_length=300,
        help_text="Deux ou trois phrases affichées en haut de la page du groupe (300 caractères au plus). "
        "Modifiable aussi par ses membres depuis le site.",
    )
    logo = models.ImageField(
        "logo", upload_to="groupes/logos/", blank=True,
        help_text="Affiché sur la page du groupe et en haut de ses QR codes « sticker ». PNG transparent de préférence.",
    )
    cover = models.ImageField(
        "image d'en-tête", upload_to="groupes/couvertures/", blank=True,
        help_text="Grande image en haut de la page du groupe (format paysage, 1600 px de large ou plus).",
    )
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

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = group_slug(self)
        super().save(*args, **kwargs)

    @property
    def calendar_city(self):
        """Ville de l'agenda auquel s'abonner pour suivre ce groupe (None si aucune ville connue à proximité)."""
        return self.agenda_city or nearest_city(self.latitude, self.longitude)



def group_slug(group):
    """Adresse unique de la page du groupe, tirée de son nom (« berlin-insoumise », « berlin-insoumise-2 »…).
    Jamais uniquement des chiffres : /groupes/<nombre> reste l'ancienne adresse par identifiant."""
    base = slugify(group.name)[:190] or "groupe"
    if base.isdigit():
        base = f"groupe-{base}"
    slug, n = base, 2
    while ActionGroup.objects.filter(slug=slug).exclude(pk=group.pk).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


class ActionGroupLink(models.Model):
    """Réseau social d'un groupe d'action (Instagram, Facebook…), affiché dans la liste des groupes."""

    group = models.ForeignKey(ActionGroup, verbose_name="groupe", on_delete=models.CASCADE, related_name="links")
    network = models.CharField("réseau", max_length=20, choices=SocialLink.NETWORKS)
    url = models.URLField("adresse du compte")
    order = models.PositiveSmallIntegerField("ordre", default=0)
    show_in_list = models.BooleanField(
        "aussi dans la liste", default=True,
        help_text="Coché : le réseau apparaît dans la liste des groupes, à droite de la carte, en plus de la bulle "
                  "qui s'ouvre sur la carte. Décoché : seulement dans la bulle. Gardez cochés les réseaux principaux "
                  "pour que la liste reste lisible.",
    )

    class Meta:
        verbose_name = "réseau social du groupe"
        verbose_name_plural = "réseaux sociaux du groupe"
        ordering = ["order", "network"]

    def __str__(self):
        return f"{self.get_network_display()} — {self.group}"

class ActionGroupPhoto(models.Model):
    """Photo affichée sur la page d'un groupe d'action, ajoutée par ses membres (ou un·e admin) depuis le site."""

    group = models.ForeignKey(ActionGroup, verbose_name="groupe", on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField("photo", upload_to="groupes/%Y/%m/")
    caption = models.CharField("légende", max_length=200, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="ajoutée par", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField("ajoutée le", auto_now_add=True)

    class Meta:
        verbose_name = "photo du groupe"
        verbose_name_plural = "photos du groupe"
        ordering = ["-created_at"]

    def __str__(self):
        return self.caption or f"Photo {self.pk} — {self.group}"

    def delete(self, *args, **kwargs):
        storage, name = self.image.storage, self.image.name
        super().delete(*args, **kwargs)
        if name:
            storage.delete(name)


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


class Announcement(models.Model):
    """Message du bandeau défilant en haut du site (« Site en construction », « Élection bientôt »…)."""

    text_fr = models.CharField("message (français)", max_length=200)
    text_en = models.CharField(
        "message (anglais)", max_length=200, blank=True,
        help_text="Facultatif : à défaut, la version française s'affiche.",
    )
    text_de = models.CharField(
        "message (allemand)", max_length=200, blank=True,
        help_text="Facultatif : à défaut, la version française s'affiche.",
    )
    order = models.PositiveSmallIntegerField("ordre", default=0, help_text="Les plus petits nombres défilent en premier.")
    is_active = models.BooleanField("affiché", default=True)

    class Meta:
        verbose_name = "message du bandeau"
        verbose_name_plural = "messages du bandeau"
        ordering = ["order", "id"]

    def __str__(self):
        return self.text_fr


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


class MemberProfile(models.Model):
    """Informations d'un compte du site en plus de celles de Django : son groupe d'action (choisi à l'inscription)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile",
                                verbose_name="compte")
    action_group = models.ForeignKey(
        ActionGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name="members",
        verbose_name="groupe d'action", help_text="Vide : membre d'aucun groupe d'action.",
    )

    class Meta:
        verbose_name = "profil"
        verbose_name_plural = "profils"

    def __str__(self):
        return str(self.user)


class SignupForm(models.Model):
    """Formulaire Zetkin vers lequel le bouton « Je m'engage » (page « Je soutiens ») envoie les personnes d'une ville.
    La ligne « Par défaut » (ville vide) sert pour « Autre ville » et pour les villes sans formulaire."""

    DEFAULT = ""
    city = models.CharField(
        "ville", max_length=40, unique=True, blank=True,
        help_text="Nom de la ville, en toutes lettres (ex. Berlin). Laisser vide pour le formulaire par défaut "
        "(autre ville, ou ville sans formulaire).",
    )
    url = models.URLField("formulaire Zetkin", help_text="Ex. https://app.zetkin.org/o/1030/surveys/1234")

    class Meta:
        verbose_name = "formulaire « Je m'engage »"
        verbose_name_plural = "formulaires « Je m'engage »"
        ordering = ["city"]

    def clean(self):
        self.city = " ".join(self.city.split())  # espaces superflus : « Berlin » et « Berlin  » sont la même ville

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

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


class GroupVisit(models.Model):
    """Visite de la page d'un groupe d'action (/groupes/<adresse>), affichée à ses membres dans le panneau « QR code ».
    Comptée à part des visites du site (page « Trackers ») : une par onglet et par groupe, sans les membres du groupe."""

    group = models.ForeignKey(ActionGroup, verbose_name="groupe", on_delete=models.CASCADE, related_name="visits")
    lang = models.CharField("langue", max_length=2, choices=TRACKER_LANGS)
    source = models.CharField("origine", max_length=60, blank=True, help_text="Vide : accès direct (QR code, lien…).")
    created_at = models.DateTimeField("le", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "visite de la page d'un groupe"
        verbose_name_plural = "visites des pages des groupes"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.group} · {self.created_at:%Y-%m-%d %H:%M}"


class ZetkinEventQuerySet(models.QuerySet):
    def upcoming(self):
        """Événements pas encore terminés (heures locales du lieu comparées à l'heure de Paris : à quelques heures près)."""
        return self.filter(end__gte=timezone.now())


class ZetkinEvent(models.Model):
    """Événement public de l'agenda, copié depuis Zetkin toutes les heures (tâche Celery core.tasks.sync_zetkin_events).
    À modifier dans Zetkin : la prochaine synchronisation écrase les changements faits ici.

    Les heures de Zetkin sont « flottantes » (heure locale du lieu) : on les enregistre comme heures de Paris,
    pour que l'admin et l'API les affichent telles quelles."""

    zetkin_id = models.CharField("identifiant Zetkin", max_length=64, unique=True)
    title = models.CharField("titre", max_length=300)
    description = models.TextField("description", blank=True)
    start = models.DateTimeField("début", db_index=True)
    end = models.DateTimeField("fin", db_index=True)
    location = models.CharField("lieu", max_length=300, blank=True)
    city = models.CharField("ville", max_length=40, blank=True, db_index=True)
    latitude = models.FloatField("latitude", null=True, blank=True)
    longitude = models.FloatField("longitude", null=True, blank=True)
    url = models.URLField("lien d'inscription", max_length=500, blank=True)
    image = models.URLField("image", max_length=500, blank=True)
    project_id = models.PositiveIntegerField("id du projet Zetkin")
    category = models.CharField("projet", max_length=200, blank=True)
    created_at = models.DateTimeField("importé le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", default=timezone.now, help_text="Dernier changement venu de Zetkin.")
    synced_at = models.DateTimeField("synchronisé le", default=timezone.now, help_text="Dernière fois vu dans Zetkin.")

    objects = ZetkinEventQuerySet.as_manager()

    class Meta:
        verbose_name = "événement Zetkin"
        verbose_name_plural = "événements Zetkin"
        ordering = ["start"]

    def __str__(self):
        return self.title

    def as_dict(self):
        """Format de l'API /api/events/ et des flux .ics (heures sans fuseau, comme dans Zetkin)."""
        def local(dt):
            return timezone.localtime(dt).replace(tzinfo=None).isoformat()

        return {
            "id": self.zetkin_id,
            "title": self.title,
            "description": self.description,
            "start": local(self.start),
            "end": local(self.end),
            "location": self.location,
            "city": self.city or None,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "url": self.url,
            "image": self.image or None,
            "category": self.category,
        }


class SupportersCount(models.Model):
    """Nombre de soutiens à la candidature de Jean-Luc Mélenchon (Action populaire), relevé toutes les heures
    par la tâche Celery core.tasks.sync_supporters_count. Une ligne par relevé : le site affiche le dernier."""

    count = models.PositiveIntegerField("soutiens")
    fetched_at = models.DateTimeField("relevé le", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "relevé du nombre de soutiens"
        verbose_name_plural = "relevés du nombre de soutiens"
        ordering = ["-fetched_at"]
        get_latest_by = "fetched_at"

    def __str__(self):
        return f"{self.count} soutiens"

    @classmethod
    def current(cls):
        """Dernière valeur relevée, ou None si aucun relevé n'a encore réussi."""
        latest = cls.objects.only("count").first()
        return latest.count if latest else None
