from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from .sanitize import clean_html


def unique_slug(instance, value, max_length=200):
    base = slugify(value)[: max_length - 8] or "article"
    slug, n = base, 2
    model = type(instance)
    while model.objects.filter(slug=slug).exclude(pk=instance.pk).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


class Category(models.Model):
    name = models.CharField("nom", max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True, blank=True)

    class Meta:
        verbose_name = "catégorie"
        verbose_name_plural = "catégories"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name, 90)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class CollectiveAuthor(models.Model):
    """Signature collective d'un article (« Berlin Insoumise »…), pour les annonces communes."""

    name = models.CharField("nom", max_length=80, unique=True)

    class Meta:
        verbose_name = "signature collective"
        verbose_name_plural = "signatures collectives"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Article(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PENDING = "pending", "À valider"
        PUBLISHED = "published", "Publié"

    #: Nombre de validations (par des comptes différents de l'auteur·ice) nécessaires pour publier.
    REQUIRED_APPROVALS = 2

    title = models.CharField("titre", max_length=200)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    excerpt = models.CharField("chapô", max_length=400, blank=True)
    content = models.TextField("contenu", help_text="Texte mis en forme avec l'éditeur ; nettoyé automatiquement à l'enregistrement.")
    cover_image = models.ImageField("image de couverture", upload_to="articles/%Y/%m/", blank=True)
    category = models.ForeignKey(
        Category, verbose_name="catégorie", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="articles",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="auteur·ice",
        on_delete=models.PROTECT, related_name="articles",
        help_text="Compte qui a créé l'article (droits de modification).",
    )
    authors = models.ManyToManyField(
        settings.AUTH_USER_MODEL, verbose_name="signé par", blank=True, related_name="signed_articles",
        help_text="Auteur·ices affiché·es ; ils et elles peuvent aussi modifier l'article.",
    )
    collectives = models.ManyToManyField(
        CollectiveAuthor, verbose_name="signatures collectives", blank=True, related_name="articles",
    )
    action_group = models.ForeignKey(
        "core.ActionGroup", verbose_name="groupe d'action", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="articles",
        help_text="Article publié au nom d'un groupe d'action : affiché sur la page du groupe.",
    )
    status = models.CharField("statut", max_length=12, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField("date de publication", null=True, blank=True)
    created_at = models.DateTimeField("créé le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        verbose_name = "article"
        verbose_name_plural = "articles"
        ordering = ["-published_at", "-created_at"]
        permissions = [
            ("publish_article", "Peut publier un article"),
            ("manage_all_articles", "Peut modifier et supprimer les articles des autres"),
            ("review_article", "Peut valider les articles « À valider »"),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title)
        self.content = clean_html(self.content)
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    def is_signed_by(self, user):
        """Créateur·ice ou co-auteur·ice de l'article."""
        return bool(user and user.is_authenticated) and (
            self.author_id == user.id or any(a.id == user.id for a in self.authors.all())
        )

    def byline(self):
        """Signature affichée : signatures collectives puis auteur·ices (à défaut, le compte créateur)."""
        names = [c.name for c in self.collectives.all()]
        names += [u.get_full_name() or u.get_username() for u in self.authors.all()]
        if not names:
            names = [self.author.get_full_name() or self.author.get_username()]
        return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " et " + names[-1]

    def approve(self, user):
        """Enregistre la validation de `user` ; publie l'article dès qu'il en a assez. Renvoie True si publié."""
        ArticleApproval.objects.get_or_create(article=self, user=user)
        # Compte en base (et non `self.approvals`, qui peut venir d'un prefetch antérieur à cette validation)
        if self.status == self.Status.PENDING and ArticleApproval.objects.filter(article=self).count() >= self.REQUIRED_APPROVALS:
            self.status = self.Status.PUBLISHED
            self.save()
            return True
        return False


class ArticleApproval(models.Model):
    """Validation d'un article « À valider » par un compte autre que celui de l'auteur·ice."""

    article = models.ForeignKey(Article, verbose_name="article", on_delete=models.CASCADE, related_name="approvals")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="validé par", on_delete=models.CASCADE, related_name="article_approvals",
    )
    created_at = models.DateTimeField("validé le", auto_now_add=True)

    class Meta:
        verbose_name = "validation"
        verbose_name_plural = "validations"
        ordering = ["created_at"]
        constraints = [models.UniqueConstraint(fields=["article", "user"], name="one_approval_per_user")]

    def __str__(self):
        return f"{self.user} → {self.article}"


class ArticleImage(models.Model):
    """Image insérée dans le corps d'un article depuis l'éditeur."""

    image = models.ImageField("image", upload_to="articles/contenu/%Y/%m/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="envoyée par", null=True,
        on_delete=models.SET_NULL, related_name="article_images",
    )
    created_at = models.DateTimeField("envoyée le", auto_now_add=True)

    class Meta:
        verbose_name = "image d'article"
        verbose_name_plural = "images d'articles"
        ordering = ["-created_at"]

    def __str__(self):
        return self.image.name


class ArticleComment(models.Model):
    """Commentaire de relecture sur un article non publié (« attention, faute ici », « plutôt cette formulation »…).

    Visible seulement par les auteur·ices de l'article et les comptes qui peuvent valider ; l'auteur·ice indique
    ensuite s'il a été pris en compte ou non.
    """

    class Status(models.TextChoices):
        OPEN = "open", "À traiter"
        DONE = "done", "Pris en compte"
        DECLINED = "declined", "Pas pris en compte"

    article = models.ForeignKey(Article, verbose_name="article", on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="auteur·ice du commentaire", null=True,
        on_delete=models.SET_NULL, related_name="article_comments",
    )
    text = models.TextField("commentaire", max_length=3000)
    status = models.CharField("suite donnée", max_length=10, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField("écrit le", auto_now_add=True)
    updated_at = models.DateTimeField("modifié le", auto_now=True)

    class Meta:
        verbose_name = "commentaire de relecture"
        verbose_name_plural = "commentaires de relecture"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.author} → {self.article} : {self.text[:40]}"
