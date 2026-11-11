from django.contrib import admin

from .models import Article, ArticleImage, Category
from .widgets import RichTextWidget


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "category", "status", "published_at", "updated_at"]
    list_filter = ["status", "category", "author"]
    search_fields = ["title", "excerpt", "content"]
    prepopulated_fields = {"slug": ["title"]}
    date_hierarchy = "created_at"
    actions = ["publish", "unpublish"]
    fieldsets = [
        (None, {"fields": ["title", "slug", "excerpt", "cover_image", "content"]}),
        ("Publication", {"fields": ["category", "status", "author", "published_at"]}),
    ]

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "content":
            kwargs["widget"] = RichTextWidget
        return super().formfield_for_dbfield(db_field, request, **kwargs)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.has_perm("blog.manage_all_articles") or request.user.has_perm("blog.publish_article"):
            return qs
        return qs.filter(author=request.user)

    def get_readonly_fields(self, request, obj=None):
        readonly = ["published_at"]
        if not request.user.has_perm("blog.publish_article"):
            readonly.append("status")
        if not request.user.has_perm("blog.manage_all_articles"):
            readonly.append("author")
        return readonly

    def has_change_permission(self, request, obj=None):
        allowed = super().has_change_permission(request, obj)
        if obj is not None and allowed and obj.author_id != request.user.id:
            return request.user.has_perm("blog.manage_all_articles")
        return allowed

    def has_delete_permission(self, request, obj=None):
        allowed = super().has_delete_permission(request, obj)
        if obj is not None and allowed and obj.author_id != request.user.id:
            return request.user.has_perm("blog.manage_all_articles")
        return allowed

    def save_model(self, request, obj, form, change):
        if not change and not obj.author_id:
            obj.author = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description="Publier les articles sélectionnés", permissions=["publish"])
    def publish(self, request, queryset):
        for article in queryset:
            article.status = Article.Status.PUBLISHED
            article.save()

    @admin.action(description="Repasser en brouillon", permissions=["publish"])
    def unpublish(self, request, queryset):
        queryset.update(status=Article.Status.DRAFT)

    def has_publish_permission(self, request):
        return request.user.has_perm("blog.publish_article")


@admin.register(ArticleImage)
class ArticleImageAdmin(admin.ModelAdmin):
    """Images envoyées depuis l'éditeur (utile pour faire le ménage)."""

    list_display = ["image", "uploaded_by", "created_at"]
    list_filter = ["created_at"]
    readonly_fields = ["uploaded_by", "created_at"]
