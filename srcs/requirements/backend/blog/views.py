from django.db.models import Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from .models import Article, Category
from .permissions import ArticlePermission, CategoryPermission
from .serializers import ArticleListSerializer, ArticleSerializer, CategorySerializer, can_approve


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
        qs = Article.objects.select_related("author", "category").prefetch_related("approvals__user")
        user = self.request.user
        published = Q(status=Article.Status.PUBLISHED)
        if not user.is_authenticated:
            qs = qs.filter(published)
        elif not (user.has_perm("blog.publish_article") or user.has_perm("blog.manage_all_articles")):
            visible = published | Q(author=user)
            if user.has_perm("blog.add_article"):
                visible |= Q(status=Article.Status.PENDING)  # les rédacteur·ices relisent les articles à valider
            qs = qs.filter(visible)

        params = self.request.query_params
        if params.get("category"):
            qs = qs.filter(category__slug=params["category"])
        if params.get("status") in Article.Status.values:
            qs = qs.filter(status=params["status"])
        return qs

    def get_serializer_class(self):
        return ArticleListSerializer if self.action == "list" else ArticleSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def approve(self, request, slug=None):
        """Valide un article « À valider » ; il est publié à la 2e validation d'un compte différent."""
        article = self.get_object()
        if not can_approve(request.user, article):
            return Response(
                {"detail": "Vous ne pouvez pas valider cet article (vous en êtes l'auteur·ice, vous l'avez déjà validé, "
                           "ou il n'est pas à valider)."},
                status=status.HTTP_403_FORBIDDEN,
            )
        article.approve(request.user)
        article = self.get_queryset().get(pk=article.pk)
        return Response(ArticleSerializer(article, context=self.get_serializer_context()).data)
