from django.contrib import admin
from django.db.models import Q

from .permissions import can_publish_now
from .models import Article, ArticleApproval, ArticleComment, ArticleImage, Category, CollectiveAuthor
from .widgets import RichTextWidget


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(CollectiveAuthor)
class CollectiveAuthorAdmin(admin.ModelAdmin):
    """Signatures collectives proposées dans l'éditeur d'articles (« Berlin Insoumise »…)."""

    list_display = ["name"]
    search_fields = ["name"]


class ApprovalInline(admin.TabularInline):
    model = ArticleApproval
    extra = 0
    fields = ["user", "created_at"]
    readonly_fields = ["user", "created_at"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "category", "status", "approvals_count", "published_at", "updated_at"]
    inlines = [ApprovalInline]
    list_filter = ["status", "category", "action_group", "author"]
    search_fields = ["title", "excerpt", "content"]
    prepopulated_fields = {"slug": ["title"]}
    date_hierarchy = "created_at"
    actions = ["publish_now", "unpublish"]
    fieldsets = [
        (None, {"fields": ["title", "slug", "excerpt", "cover_image", "content"]}),
        ("Publication", {"fields": ["category", "action_group", "status", "author", "authors", "collectives", "published_at"]}),
    ]
    filter_horizontal = ["authors", "collectives"]

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "content":
            kwargs["widget"] = RichTextWidget
        return super().formfield_for_dbfield(db_field, request, **kwargs)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.has_perm("blog.manage_all_articles") or request.user.has_perm("blog.publish_article"):
            return qs
        return qs.filter(pk__in=Article.objects.filter(Q(author=request.user) | Q(authors=request.user)).values("pk"))

    def get_readonly_fields(self, request, obj=None):
        # La publication passe par 2 validations sur le site ; seul·es les admins du site
        # peuvent changer le statut ici (et donc publier directement).
        readonly = ["published_at"]
        if not can_publish_now(request.user):
            readonly.append("status")
        if not request.user.has_perm("blog.manage_all_articles"):
            readonly.append("author")
        return readonly

    def has_change_permission(self, request, obj=None):
        allowed = super().has_change_permission(request, obj)
        if obj is not None and allowed and not obj.is_signed_by(request.user):
            return request.user.has_perm("blog.manage_all_articles")
        return allowed

    def has_delete_permission(self, request, obj=None):
        allowed = super().has_delete_permission(request, obj)
        if obj is not None and allowed and not obj.is_signed_by(request.user):
            return request.user.has_perm("blog.manage_all_articles")
        return allowed

    def save_model(self, request, obj, form, change):
        if not change and not obj.author_id:
            obj.author = request.user
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        obj = form.instance
        if not obj.authors.exists() and not obj.collectives.exists():
            obj.authors.add(obj.author)  # un article est toujours signé
        # Comme sur le site : modifier un article non publié relance sa validation.
        if change and form.changed_data and obj.status != Article.Status.PUBLISHED:
            obj.approvals.all().delete()

    @admin.display(description="validations")
    def approvals_count(self, obj):
        return f"{obj.approvals.count()} / {Article.REQUIRED_APPROVALS}"

    @admin.action(description="Publier directement (sans attendre les validations)", permissions=["publish_now"])
    def publish_now(self, request, queryset):
        n = 0
        for article in queryset.exclude(status=Article.Status.PUBLISHED):
            article.status = Article.Status.PUBLISHED
            article.save()  # renseigne la date de publication
            n += 1
        self.message_user(request, f"{n} article(s) publié(s).")

    def has_publish_now_permission(self, request):
        return can_publish_now(request.user)

    @admin.action(description="Repasser en brouillon", permissions=["publish"])
    def unpublish(self, request, queryset):
        queryset.update(status=Article.Status.DRAFT)
        ArticleApproval.objects.filter(article__in=queryset).delete()

    def has_publish_permission(self, request):
        return request.user.has_perm("blog.publish_article")


@admin.register(ArticleImage)
class ArticleImageAdmin(admin.ModelAdmin):
    """Images envoyées depuis l'éditeur (utile pour faire le ménage)."""

    list_display = ["image", "uploaded_by", "created_at"]
    list_filter = ["created_at"]
    readonly_fields = ["uploaded_by", "created_at"]


@admin.register(ArticleComment)
class ArticleCommentAdmin(admin.ModelAdmin):
    """Commentaires de relecture (écrits et traités depuis la page de l'article sur le site)."""

    list_display = ["article", "author", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["text", "article__title"]
    readonly_fields = ["article", "author", "created_at", "updated_at"]
