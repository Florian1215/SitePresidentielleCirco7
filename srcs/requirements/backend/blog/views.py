from django.db.models import Count, Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView

from .models import Article, Category, CollectiveAuthor
from .permissions import ArticlePermission, CategoryPermission, CollectiveAuthorPermission, can_publish_now
from .serializers import (
    ArticleListSerializer,
    ArticleSerializer,
    CategorySerializer,
    CollectiveAuthorSerializer,
    can_approve,
    signers_payload,
)


class CategoryViewSet(viewsets.ModelViewSet):
    """Catégories ; les supprimer laisse leurs articles sans catégorie."""

    queryset = Category.objects.annotate(n_articles=Count("articles"))
    serializer_class = CategorySerializer
    permission_classes = [CategoryPermission]
    pagination_class = None
    lookup_field = "slug"


class CollectiveAuthorViewSet(viewsets.ModelViewSet):
    """Signatures collectives (« Berlin Insoumise »…) ; les supprimer les retire des articles signés."""

    queryset = CollectiveAuthor.objects.annotate(n_articles=Count("articles"))
    serializer_class = CollectiveAuthorSerializer
    permission_classes = [CollectiveAuthorPermission]
    pagination_class = None

    def perform_destroy(self, instance):
        # Un article ne reste jamais sans signature : à défaut, il revient à son créateur·ice.
        orphans = list(instance.articles.all())
        instance.delete()
        for article in orphans:
            if not article.collectives.exists() and not article.authors.exists():
                article.authors.add(article.author)


class ArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [ArticlePermission]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = "slug"
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "excerpt", "content"]

    def get_queryset(self):
        qs = Article.objects.select_related("author", "category").prefetch_related("approvals__user", "authors", "collectives")
        user = self.request.user
        published = Q(status=Article.Status.PUBLISHED)
        if not user.is_authenticated:
            qs = qs.filter(published)
        elif not (user.has_perm("blog.publish_article") or user.has_perm("blog.manage_all_articles")):
            visible = published | Q(author=user) | Q(authors=user)
            if user.has_perm("blog.add_article"):
                visible |= Q(status=Article.Status.PENDING)  # les rédacteur·ices relisent les articles à valider
            qs = qs.filter(pk__in=Article.objects.filter(visible).values("pk"))

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

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def publish(self, request, slug=None):
        """Publication directe, sans attendre les validations : réservée aux administrateur·ices principaux."""
        if not can_publish_now(request.user):
            return Response({"detail": "Seul·es les administrateur·ices principaux peuvent publier directement."},
                            status=status.HTTP_403_FORBIDDEN)
        article = self.get_object()
        if article.status != Article.Status.PUBLISHED:
            article.status = Article.Status.PUBLISHED
            article.save()
        article = self.get_queryset().get(pk=article.pk)
        return Response(ArticleSerializer(article, context=self.get_serializer_context()).data)


class SignersView(APIView):
    """Auteur·ices possibles d'un article (champ « Auteur·ices » de l'éditeur)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.has_perm("blog.add_article"):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(signers_payload())
