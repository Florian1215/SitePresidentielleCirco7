from django.urls import path
from rest_framework.routers import DefaultRouter

from .images import ArticleImageUploadView

from .views import ArticleViewSet, CategoryViewSet

router = DefaultRouter()
router.register("articles", ArticleViewSet, basename="article")
router.register("categories", CategoryViewSet, basename="category")

urlpatterns = [
    path("articles/images/", ArticleImageUploadView.as_view(), name="article-image-upload"),
    *router.urls,
]
