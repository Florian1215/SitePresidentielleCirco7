from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseNotAllowed, JsonResponse
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .action_populaire import import_status, start_import_in_background
from .models import ActionGroup, ActionGroupLink, FaqEntry, FriendSite, PollingStation, SocialLink


@admin.register(FriendSite)
class FriendSiteAdmin(admin.ModelAdmin):
    list_display = ["name", "url", "order", "is_active"]
    list_editable = ["order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "url"]


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ["network", "url", "order", "is_active"]
    list_editable = ["order", "is_active"]
    list_filter = ["network", "is_active"]
    search_fields = ["url"]


class ActionGroupLinkInline(admin.TabularInline):
    model = ActionGroupLink
    extra = 1
    fields = ["network", "url", "order"]


@admin.register(ActionGroup)
class ActionGroupAdmin(admin.ModelAdmin):
    change_list_template = "admin/core/actiongroup/change_list.html"
    inlines = [ActionGroupLinkInline]
    list_display = ["name", "city", "country", "networks", "is_active", "updated_at"]
    list_editable = ["is_active"]
    list_filter = ["country", "is_active"]
    search_fields = ["name", "city"]
    readonly_fields = ["ap_id", "updated_at"]
    fieldsets = [
        (None, {"fields": ["name", "city", "country", "url", "is_active"]}),
        ("Position sur la carte", {
            "fields": ["latitude", "longitude"],
            "description": "Coordonnées GPS (ex. Berlin : latitude 52.52, longitude 13.40).",
        }),
        ("Import automatique", {"fields": ["ap_id", "updated_at"], "classes": ["collapse"]}),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("links")

    @admin.display(description="réseaux")
    def networks(self, obj):
        return ", ".join(link.get_network_display() for link in obj.links.all()) or "—"

    def get_urls(self):
        return [
            path("importer/", self.admin_site.admin_view(self.import_new), name="core_actiongroup_import"),
            path(
                "importer/<str:job>/",
                self.admin_site.admin_view(self.import_progress),
                name="core_actiongroup_import_status",
            ),
            *super().get_urls(),
        ]

    def import_new(self, request):
        """Bouton « Importer les nouveaux groupes » : lance l'interrogation d'Action populaire en tâche de fond."""
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])
        if not self.has_add_permission(request):
            raise PermissionDenied
        job = start_import_in_background()
        if job is None:
            return JsonResponse({"error": "Un import est déjà en cours."}, status=409)
        return JsonResponse({"job": job})

    def import_progress(self, request, job):
        if not self.has_add_permission(request):
            raise PermissionDenied
        return JsonResponse(import_status(job) or {"state": "unknown"})


@admin.register(FaqEntry)
class FaqEntryAdmin(admin.ModelAdmin):
    list_display = ["question_fr", "order", "is_active", "translated"]
    list_editable = ["order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["question_fr", "answer_fr", "question_en", "question_de"]
    fieldsets = [
        ("Français", {"fields": ["question_fr", "answer_fr"]}),
        ("Anglais", {"fields": ["question_en", "answer_en"], "classes": ["collapse"]}),
        ("Allemand", {"fields": ["question_de", "answer_de"], "classes": ["collapse"]}),
        ("Affichage", {"fields": ["order", "is_active"]}),
    ]

    @admin.display(description="traductions")
    def translated(self, obj):
        langs = [code for code, q, a in (("EN", obj.question_en, obj.answer_en), ("DE", obj.question_de, obj.answer_de)) if q and a]
        return ", ".join(langs) or "—"


@admin.register(PollingStation)
class PollingStationAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "country", "is_active", "updated_at"]
    list_editable = ["is_active"]
    list_filter = ["country", "is_active"]
    search_fields = ["name", "city", "address"]
    readonly_fields = ["updated_at"]
    fieldsets = [
        (None, {
            "fields": ["name", "address", "city", "country", "info", "url", "is_active"],
            "description": (
                "Les bureaux de vote de l'étranger sont fixés par arrêté quelques mois avant le scrutin "
                "(liste publiée sur diplomatie.gouv.fr). Seuls les bureaux « affichés » apparaissent sur le site."
            ),
        }),
        ("Position sur la carte", {
            "fields": ["latitude", "longitude"],
            "description": "Coordonnées GPS (ex. Berlin : latitude 52.52, longitude 13.40).",
        }),
        ("Suivi", {"fields": ["updated_at"], "classes": ["collapse"]}),
    ]


# ---------- Comptes : validation des demandes faites depuis la page « Se connecter » ----------

User = get_user_model()
WRITERS_GROUP = "Rédacteur·ices"


class PendingFilter(admin.SimpleListFilter):
    title = "validation"
    parameter_name = "en_attente"

    def lookups(self, request, model_admin):
        return [("oui", "En attente de validation")]

    def queryset(self, request, queryset):
        if self.value() == "oui":
            return queryset.filter(is_active=False, last_login__isnull=True)
        return queryset


admin.site.unregister(User)


@admin.register(User)
class AccountAdmin(DjangoUserAdmin):
    list_display = ["username", "first_name", "last_name", "can_write", "is_staff", "date_joined"]
    list_filter = [PendingFilter, "is_staff", "groups"]
    ordering = ["-date_joined"]
    actions = ["approve_writers", "deactivate"]

    class Media:
        js = ["core/admin/writer-toggle.js"]

    @admin.display(description="peut écrire")
    def can_write(self, obj):
        """Case à cocher : un clic donne (ou retire) le droit d'écrire, en validant le compte au passage."""
        in_group = any(g.name == WRITERS_GROUP for g in obj.groups.all())
        allowed = obj.is_active and obj.has_perm("blog.add_article")
        # Droit venant d'ailleurs (super-utilisateur·ice, groupe Éditeur·ices…) : non modifiable ici.
        locked = allowed and not in_group
        return format_html(
            '<input type="checkbox" class="writer-toggle" style="width:20px;height:20px;cursor:pointer;margin:0" data-url="{}" aria-label="Peut écrire : {}"{}{}{}>',
            reverse("admin:core_account_toggle_writer", args=[obj.pk]),
            obj.get_full_name() or obj.get_username(),
            mark_safe(" checked") if allowed else "",
            mark_safe(" disabled") if locked else "",
            mark_safe(' title="Droit donné par un autre groupe ou le statut super-utilisateur"') if locked else "",
        )

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("groups")

    def get_urls(self):
        return [
            path(
                "<int:pk>/toggle-writer/",
                self.admin_site.admin_view(self.toggle_writer),
                name="core_account_toggle_writer",
            ),
            *super().get_urls(),
        ]

    def toggle_writer(self, request, pk):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])
        user = self.get_object(request, pk)
        if user is None or not self.has_change_permission(request, user):
            raise PermissionDenied
        group, _ = Group.objects.get_or_create(name=WRITERS_GROUP)
        if request.POST.get("allowed") == "1":
            user.groups.add(group)
            if not user.is_active:
                user.is_active = True
                user.save(update_fields=["is_active"])
        else:
            user.groups.remove(group)
        user = User.objects.get(pk=user.pk)  # recharge (cache des permissions)
        return JsonResponse({"allowed": user.is_active and user.has_perm("blog.add_article")})

    @admin.action(description="Valider : activer le compte et autoriser à écrire des articles")
    def approve_writers(self, request, queryset):
        group, _ = Group.objects.get_or_create(name=WRITERS_GROUP)
        for user in queryset:
            user.groups.add(group)
        n = queryset.update(is_active=True)
        self.message_user(request, f"{n} compte(s) validé(s) : ils peuvent se connecter et écrire des articles.")

    @admin.action(description="Désactiver (refuser ou retirer l'accès)")
    def deactivate(self, request, queryset):
        n = queryset.exclude(pk=request.user.pk).update(is_active=False)
        self.message_user(request, f"{n} compte(s) désactivé(s).")
