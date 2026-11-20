from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from blog.share import ArticleShareView

admin.site.site_header = "Administration — 7e circonscription des Français·es de l'étranger"
admin.site.site_title = "Administration LFI 7e circo"
admin.site.index_title = "Gestion du site"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/", include("blog.urls")),
    # Aperçu des liens d'articles pour les robots des réseaux (nginx y renvoie /blog/<slug>)
    path("api/share/articles/<slug:slug>/", ArticleShareView.as_view(), name="article-share"),
]

# En production, nginx sert /media/ ; en développement, c'est Django.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
