from rest_framework import serializers

from .models import Article, Category


def can_approve(user, article):
    """Un compte rédacteur peut valider un article « À valider » dont il n'est pas l'auteur·ice, une seule fois."""
    return bool(
        user and user.is_authenticated
        and user.has_perm("blog.add_article")
        and article.status == Article.Status.PENDING
        and article.author_id != user.id
        and not any(a.user_id == user.id for a in article.approvals.all())
    )


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]
        read_only_fields = ["slug"]


class ArticleSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    category_detail = CategorySerializer(source="category", read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    remove_cover = serializers.BooleanField(write_only=True, required=False, default=False)
    approvals = serializers.SerializerMethodField()
    approvals_required = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    is_author = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "excerpt", "content", "cover_image", "remove_cover",
            "category", "category_detail", "author_name", "status",
            "published_at", "created_at", "updated_at", "can_edit", "can_delete",
            "approvals", "approvals_required", "can_approve", "is_author",
        ]
        read_only_fields = ["slug", "published_at", "created_at", "updated_at"]

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.get_username()

    def _user_can(self, obj, perm):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated):
            return False
        return user.has_perm(f"blog.{perm}_article") and (
            obj.author_id == user.id or user.has_perm("blog.manage_all_articles")
        )

    def get_can_edit(self, obj):
        return self._user_can(obj, "change")

    def get_can_delete(self, obj):
        return self._user_can(obj, "delete")

    def get_approvals(self, obj):
        return [a.user.get_full_name() or a.user.get_username() for a in obj.approvals.all()]

    def get_is_author(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)

    def get_approvals_required(self, obj):
        return Article.REQUIRED_APPROVALS

    def get_can_approve(self, obj):
        request = self.context.get("request")
        return bool(request) and can_approve(request.user, obj)

    def validate_status(self, value):
        # On ne publie pas directement : il faut REQUIRED_APPROVALS validations (« À valider »).
        # Un article déjà publié peut être corrigé en restant publié.
        if value == Article.Status.PUBLISHED and not (self.instance and self.instance.status == Article.Status.PUBLISHED):
            raise serializers.ValidationError(
                f"Un article doit être validé par {Article.REQUIRED_APPROVALS} autres comptes avant d'être publié : "
                "envoyez-le en validation."
            )
        return value

    def update(self, instance, validated_data):
        if validated_data.pop("remove_cover", False) and "cover_image" not in validated_data:
            instance.cover_image.delete(save=False)
            instance.cover_image = ""
        was_published = instance.status == Article.Status.PUBLISHED
        article = super().update(instance, validated_data)
        # Toute modification d'un article non publié relance la validation : on ne valide que ce qu'on a lu.
        if not was_published:
            article.approvals.all().delete()
        return article

    def create(self, validated_data):
        validated_data.pop("remove_cover", None)
        return super().create(validated_data)


class ArticleListSerializer(ArticleSerializer):
    class Meta(ArticleSerializer.Meta):
        fields = [f for f in ArticleSerializer.Meta.fields if f not in ("content", "remove_cover")]
