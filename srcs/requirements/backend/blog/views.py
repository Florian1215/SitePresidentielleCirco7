from django.db.models import Q
from rest_framework import filters, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from .models import Article, Category
from .permissions import ArticlePermission, CategoryPermission
from .serializers import ArticleListSerializer, ArticleSerializer, CategorySerializer


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [CategoryPermission]
    pagination_class = None
    lookup_field = "slug"


class ArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [ArticlePermission]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = "slug"
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "excerpt", "content"]

    def get_queryset(self):
        qs = Article.objects.select_related("author", "category")
        user = self.request.user
        published = Q(status=Article.Status.PUBLISHED)
        if not user.is_authenticated:
            qs = qs.filter(published)
        elif not (user.has_perm("blog.publish_article") or user.has_perm("blog.manage_all_articles")):
            qs = qs.filter(published | Q(author=user))

        params = self.request.query_params
        if params.get("category"):
            qs = qs.filter(category__slug=params["category"])
        if params.get("mine") == "1" and user.is_authenticated:
            qs = qs.filter(author=user)
        if params.get("status") in Article.Status.values:
            qs = qs.filter(status=params["status"])
        return qs

    def get_serializer_class(self):
        return ArticleListSerializer if self.action == "list" else ArticleSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
