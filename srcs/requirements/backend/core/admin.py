from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.admin.forms import AdminAuthenticationForm
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import HttpResponseNotAllowed, JsonResponse
from django.urls import path

from .members import can_grant_admin, is_editable, is_site_admin, member_status
from .action_populaire import import_status, start_import_in_background
from .models import ActionGroup, ActionGroupLink, FaqEntry, FriendSite, PollingStation, SignupForm, SocialLink, Tracker, Visit


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
    readonly_fields = ["ap_id", "updated_at", "calendar_city_display"]
    fieldsets = [
        (None, {"fields": ["name", "city", "country", "url", "is_active"]}),
        ("Position sur la carte", {
            "fields": ["latitude", "longitude"],
            "description": "Coordonnées GPS (ex. Berlin : latitude 52.52, longitude 13.40).",
        }),
        ("Agenda", {
            "fields": ["agenda_city", "calendar_city_display"],
            "description": "Calendrier des événements auquel on peut s'abonner depuis la fiche du groupe.",
        }),
        ("Import automatique", {"fields": ["ap_id", "updated_at"], "classes": ["collapse"]}),
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("links")

    @admin.display(description="agenda proposé")
    def calendar_city_display(self, obj):
        return obj.calendar_city or "aucun (pas de ville de l'agenda à moins de 35 km)"

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


# ---------- Accès à /admin : membres du staff et admins du site ----------


class SiteAdminAuthenticationForm(AdminAuthenticationForm):
    """Connexion à /admin : en plus du staff, les admins du site (groupe « Administrateur·ices »)."""

    def confirm_login_allowed(self, user):
        if not (user.is_active and (user.is_staff or is_site_admin(user))):
            raise ValidationError(self.error_messages["invalid_login"], code="invalid_login",
                                  params={"username": self.username_field.verbose_name})


def has_admin_access(request):
    user = request.user
    return user.is_active and (user.is_staff or is_site_admin(user))


admin.site.login_form = SiteAdminAuthenticationForm
admin.site.has_permission = has_admin_access

admin.site.unregister(User)


@admin.register(User)
class AccountAdmin(DjangoUserAdmin):
    list_display = ["username", "last_name", "first_name", "member_status", "is_staff", "date_joined"]
    list_display_links = ["username"]
    list_filter = [PendingFilter, "is_active", "is_staff"]
    ordering = ["-date_joined"]
    actions = ["approve_writers", "deactivate"]

    def get_readonly_fields(self, request, obj=None):
        """Staff et super-utilisateur·ice : décidés par les super-utilisateur·ices seulement.
        Groupes (dont « Administrateur·ices ») : par les membres du staff seulement, comme sur la page « Membres »."""
        readonly = list(super().get_readonly_fields(request, obj))
        if not request.user.is_superuser:
            readonly += ["is_staff", "is_superuser", "user_permissions"]
            if not can_grant_admin(request.user):
                readonly.append("groups")
        return readonly

    def has_change_permission(self, request, obj=None):
        allowed = super().has_change_permission(request, obj)
        if obj is not None and allowed and obj.pk != request.user.pk:
            return is_editable(obj, request.user)
        return allowed

    def has_delete_permission(self, request, obj=None):
        allowed = super().has_delete_permission(request, obj)
        if obj is not None and allowed:
            return obj.pk != request.user.pk and is_editable(obj, request.user)
        return allowed

    @admin.display(description="statut", ordering="is_active")
    def member_status(self, obj):
        """Comme sur la page « Membres » du site : demande en attente, compte actif ou accès retiré."""
        return {"pending": "En attente", "active": "Actif", "revoked": "Accès retiré"}[member_status(obj)]

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


@admin.register(SignupForm)
class SignupFormAdmin(admin.ModelAdmin):
    """Bouton « Je m'engage » : ville choisie → formulaire Zetkin. Sans ligne pour une ville : la ligne « Par défaut »."""

    list_display = ["__str__", "url"]
    list_display_links = ["__str__"]
    list_editable = ["url"]
    search_fields = ["city", "url"]


@admin.register(Tracker)
class TrackerAdmin(admin.ModelAdmin):
    """Les trackers se gèrent surtout depuis la page « Trackers » du site."""

    list_display = ["name", "code", "visit_count", "created_at"]
    search_fields = ["name", "code"]
    readonly_fields = ["code", "created_at", "created_by"]

    def get_queryset(self, request):
        from django.db.models import Count

        return super().get_queryset(request).annotate(_visits=Count("visits"))

    @admin.display(description="visites", ordering="_visits")
    def visit_count(self, obj):
        return obj._visits


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    """Arrivées sur le site (comptées par le site lui-même, en lecture seule)."""

    list_display = ["created_at", "lang", "source", "referrer_host", "tracker"]
    list_filter = ["lang", "source", "tracker"]
    search_fields = ["source", "referrer_host"]
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
