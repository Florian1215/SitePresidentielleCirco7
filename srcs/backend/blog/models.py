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


class Article(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publié"

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
