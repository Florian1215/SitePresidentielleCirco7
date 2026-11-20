"""Aperçu des liens d'articles sur les réseaux (Discord, WhatsApp, Telegram, Facebook, X, Signal…).

Leurs robots ne lancent pas le JavaScript : ils ne verraient que les balises par défaut de l'application React.
nginx (requirements/nginx/conf/common.conf) leur envoie donc /blog/<slug> ici, une page minimale avec les
balises Open Graph de l'article. Les personnes, elles, reçoivent toujours l'application React.
"""

import html
import re

from django.conf import settings
from django.http import HttpResponse
from django.utils.html import strip_tags
from django.views import View

from .models import Article

SITE_NAME = "Les insoumis·es de l'étranger — Circo 7"
DEFAULT_TITLE = SITE_NAME
DEFAULT_DESCRIPTION = (
    "Présidentielle 2027 : le programme de La France insoumise pour les Français·es d'Allemagne, "
    "d'Europe centrale et des Balkans."
)
DEFAULT_IMAGE = "/brand/circo7-share.jpg"


def site_url(request):
    """Adresse publique du site : DJANGO_SITE_URL (ex. https://exemple.fr), sinon celle de la requête."""
    return (settings.SITE_URL or request.build_absolute_uri("/")).rstrip("/")


def summary(article, limit=200):
    text = article.excerpt or " ".join(html.unescape(strip_tags(article.content or "")).split())
    if len(text) <= limit:
        return text
    return re.sub(r"\s+\S*$", "", text[:limit]) + "…"


class ArticleShareView(View):
    def get(self, request, slug):
        base = site_url(request)
        url = f"{base}/blog/{slug}"
        article = Article.objects.filter(slug=slug, status=Article.Status.PUBLISHED).first()
        # Article inconnu ou pas encore publié : aperçu général du site, sans rien révéler de l'article
        tags = {
            "og:type": "article" if article else "website",
            "og:site_name": SITE_NAME,
            "og:url": url,
            "og:title": article.title if article else DEFAULT_TITLE,
            "og:description": (summary(article) if article else "") or DEFAULT_DESCRIPTION,
            "og:image": base + (article.cover_image.url if article and article.cover_image else DEFAULT_IMAGE),
            "og:locale": "fr_FR",
            "twitter:card": "summary_large_image",
        }
        if article and article.published_at:
            tags["article:published_time"] = article.published_at.isoformat()
        meta = "\n".join(
            f'  <meta {"name" if key.startswith("twitter:") else "property"}="{key}" content="{html.escape(value)}">'
            for key, value in tags.items()
        )
        title = html.escape(tags["og:title"])
        page = f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>{title}</title>
  <meta name="description" content="{html.escape(tags["og:description"])}">
{meta}
  <link rel="canonical" href="{html.escape(url)}">
</head>
<body>
  <h1>{title}</h1>
  <p>{html.escape(tags["og:description"])}</p>
  <p><a href="{html.escape(url)}">Lire l'article</a></p>
</body>
</html>
"""
        return HttpResponse(page)
