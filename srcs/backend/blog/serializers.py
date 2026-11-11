from rest_framework import serializers

from .models import Article, Category


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

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "excerpt", "content", "cover_image", "remove_cover",
            "category", "category_detail", "author_name", "status",
            "published_at", "created_at", "updated_at", "can_edit", "can_delete",
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

    def validate_status(self, value):
        user = self.context["request"].user
        if value == Article.Status.PUBLISHED and not user.has_perm("blog.publish_article"):
            # Un article déjà publié peut être corrigé sans le droit de publication.
            if not (self.instance and self.instance.status == Article.Status.PUBLISHED):
                raise serializers.ValidationError(
                    "Vous n'avez pas le droit de publier : enregistrez l'article en brouillon, "
                    "un·e éditeur·ice le publiera."
                )
        return value

    def update(self, instance, validated_data):
        if validated_data.pop("remove_cover", False) and "cover_image" not in validated_data:
            instance.cover_image.delete(save=False)
            instance.cover_image = ""
        return super().update(instance, validated_data)

    def create(self, validated_data):
        validated_data.pop("remove_cover", None)
        return super().create(validated_data)


class ArticleListSerializer(ArticleSerializer):
    class Meta(ArticleSerializer.Meta):
        fields = [f for f in ArticleSerializer.Meta.fields if f not in ("content", "remove_cover")]
