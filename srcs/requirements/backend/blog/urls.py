from django.urls import path
from rest_framework.routers import DefaultRouter

from .images import ArticleImageUploadView

from .views import ArticleViewSet, CategoryViewSet, CollectiveAuthorViewSet, SignersView

router = DefaultRouter()
router.register("articles", ArticleViewSet, basename="article")
router.register("categories", CategoryViewSet, basename="category")
router.register("collective-authors", CollectiveAuthorViewSet, basename="collective-author")

urlpatterns = [
    path("articles/signers/", SignersView.as_view(), name="article-signers"),
    path("articles/images/", ArticleImageUploadView.as_view(), name="article-image-upload"),
    *router.urls,
]
