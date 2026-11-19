import json

from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import serializers

from .models import Article, Category, CollectiveAuthor
from .permissions import can_publish_now

User = get_user_model()


def signers():
    """Comptes actifs pouvant signer un article : ceux qui ont le droit d'écrire."""
    can_write = Q(groups__permissions__codename="add_article") | Q(user_permissions__codename="add_article")
    return User.objects.filter(Q(is_superuser=True) | can_write, is_active=True).distinct()


def display_name(user):
    return user.get_full_name() or user.get_username()


def can_approve(user, article):
    """Un compte rédacteur peut valider un article « À valider » dont il n'est pas l'auteur·ice, une seule fois."""
    return bool(
        user and user.is_authenticated
        and user.has_perm("blog.add_article")
        and article.status == Article.Status.PENDING
        and not article.is_signed_by(user)
        and not any(a.user_id == user.id for a in article.approvals.all())
    )


class NamedSerializer(serializers.ModelSerializer):
    """Nom unique (sans tenir compte de la casse) + nombre d'articles, montré à qui peut gérer ces éléments."""

    article_count = serializers.SerializerMethodField()
    #: Permission Django donnant accès au nombre d'articles (page « Catégories et auteurs »).
    manage_perm = ""

    def validate_name(self, value):
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("Le nom est obligatoire.")
        others = self.Meta.model.objects.filter(name__iexact=value)
        if self.instance:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError("Ce nom existe déjà.")
        return value

    def get_article_count(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and user.has_perm(self.manage_perm)):
            return None
        count = getattr(obj, "n_articles", None)
        return obj.articles.count() if count is None else count


class CategorySerializer(NamedSerializer):
    manage_perm = "blog.change_category"

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "article_count"]
        read_only_fields = ["slug"]
        validators = []

    name = serializers.CharField(max_length=80)


class CollectiveAuthorSerializer(NamedSerializer):
    manage_perm = "blog.change_collectiveauthor"

    class Meta:
        model = CollectiveAuthor
        fields = ["id", "name", "article_count"]
        validators = []

    name = serializers.CharField(max_length=80)


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
    authors_detail = serializers.SerializerMethodField()
    collectives_detail = serializers.SerializerMethodField()
    can_publish_now = serializers.SerializerMethodField()
    #: Signature, en JSON : {"authors": [id de comptes], "collectives": [id de signatures collectives]}
    signature = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "excerpt", "content", "cover_image", "remove_cover",
            "category", "category_detail", "author_name", "status",
            "published_at", "created_at", "updated_at", "can_edit", "can_delete",
            "approvals", "approvals_required", "can_approve", "is_author",
            "authors_detail", "collectives_detail", "signature", "can_publish_now",
        ]
        read_only_fields = ["slug", "published_at", "created_at", "updated_at"]

    def get_author_name(self, obj):
        return obj.byline()

    def get_authors_detail(self, obj):
        return [{"id": u.id, "name": display_name(u)} for u in obj.authors.all()]

    def get_collectives_detail(self, obj):
        return [{"id": c.id, "name": c.name} for c in obj.collectives.all()]

    def get_can_publish_now(self, obj):
        request = self.context.get("request")
        return obj.status != Article.Status.PUBLISHED and can_publish_now(getattr(request, "user", None))

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def _user_can(self, obj, perm):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated):
            return False
        return user.has_perm(f"blog.{perm}_article") and (
            obj.is_signed_by(user) or user.has_perm("blog.manage_all_articles")
        )

    def get_can_edit(self, obj):
        return self._user_can(obj, "change")

    def get_can_delete(self, obj):
        return self._user_can(obj, "delete")

    def get_approvals(self, obj):
        return [a.user.get_full_name() or a.user.get_username() for a in obj.approvals.all()]

    def get_is_author(self, obj):
        request = self.context.get("request")
        return bool(request) and obj.is_signed_by(request.user)

    def get_approvals_required(self, obj):
        return Article.REQUIRED_APPROVALS

    def get_can_approve(self, obj):
        request = self.context.get("request")
        return bool(request) and can_approve(request.user, obj)

    def validate_status(self, value):
        # On ne publie pas directement : il faut REQUIRED_APPROVALS validations (« À valider »).
        # Un article déjà publié peut être corrigé en restant publié ; l'administrateur·ice principal·e publie directement.
        if (value == Article.Status.PUBLISHED and not can_publish_now(self._user())
                and not (self.instance and self.instance.status == Article.Status.PUBLISHED)):
            raise serializers.ValidationError(
                f"Un article doit être validé par {Article.REQUIRED_APPROVALS} autres comptes avant d'être publié : "
                "envoyez-le en validation."
            )
        return value

    def validate(self, attrs):
        # L'image de couverture est obligatoire : elle illustre l'article dans la liste et en haut de sa page.
        new_cover = attrs.get("cover_image")
        removing = attrs.get("remove_cover", False)
        has_cover = bool(self.instance and self.instance.cover_image) and not removing
        if not new_cover and not has_cover:
            raise serializers.ValidationError({"cover_image": "L'image de couverture est obligatoire."})
        return attrs

    def validate_signature(self, value):
        try:
            data = json.loads(value)
            author_ids = {int(i) for i in data.get("authors", [])}
            collective_ids = {int(i) for i in data.get("collectives", [])}
        except (ValueError, TypeError, AttributeError):
            raise serializers.ValidationError("Signature invalide.")
        authors = list(signers().filter(pk__in=author_ids))
        collectives = list(CollectiveAuthor.objects.filter(pk__in=collective_ids))
        # On garde les co-auteur·ices déjà présent·es même si leur compte a perdu le droit d'écrire depuis.
        if self.instance:
            known = {u.id for u in authors}
            authors += [u for u in self.instance.authors.all() if u.id in author_ids and u.id not in known]
        if len(authors) != len(author_ids) or len(collectives) != len(collective_ids):
            raise serializers.ValidationError("Auteur·ice ou signature collective inconnu·e.")
        if not authors and not collectives:
            raise serializers.ValidationError("Choisissez au moins un·e auteur·ice ou une signature collective.")
        return {"authors": authors, "collectives": collectives}

    def _sign(self, article, signature):
        if signature is not None:
            article.authors.set(signature["authors"])
            article.collectives.set(signature["collectives"])

    def update(self, instance, validated_data):
        signature = validated_data.pop("signature", None)
        if validated_data.pop("remove_cover", False) and "cover_image" not in validated_data:
            instance.cover_image.delete(save=False)
            instance.cover_image = ""
        was_published = instance.status == Article.Status.PUBLISHED
        article = super().update(instance, validated_data)
        self._sign(article, signature)
        # Toute modification d'un article non publié relance la validation : on ne valide que ce qu'on a lu.
        if not was_published:
            article.approvals.all().delete()
        return article

    def create(self, validated_data):
        validated_data.pop("remove_cover", None)
        signature = validated_data.pop("signature", None)
        article = super().create(validated_data)
        # Sans signature précisée, l'article est signé par son créateur·ice.
        self._sign(article, signature or {"authors": [article.author], "collectives": []})
        return article


class ArticleListSerializer(ArticleSerializer):
    class Meta(ArticleSerializer.Meta):
        fields = [f for f in ArticleSerializer.Meta.fields if f not in ("content", "remove_cover", "signature")]


def signers_payload():
    """Signatures possibles d'un article : comptes rédacteurs et signatures collectives."""
    return {
        "authors": [{"id": u.id, "name": display_name(u)} for u in signers().order_by("first_name", "last_name")],
        "collectives": [{"id": c.id, "name": c.name} for c in CollectiveAuthor.objects.all()],
    }
