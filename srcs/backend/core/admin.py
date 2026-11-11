import csv

from django.contrib import admin
from django.http import HttpResponse

from .models import ActionGroup, ContactMessage, FriendSite, SocialLink, Supporter


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ["subject", "name", "email", "country", "created_at", "handled"]
    list_filter = ["handled", "country", "created_at"]
    list_editable = ["handled"]
    search_fields = ["name", "email", "subject", "message"]
    readonly_fields = ["name", "email", "country", "subject", "message", "created_at"]


@admin.register(Supporter)
class SupporterAdmin(admin.ModelAdmin):
    list_display = [
        "last_name", "first_name", "email", "country", "city",
        "wants_registration_help", "wants_to_volunteer", "created_at",
    ]
    list_filter = ["country", "wants_registration_help", "wants_reminders", "wants_to_volunteer"]
    search_fields = ["first_name", "last_name", "email", "city"]
    actions = ["export_csv"]

    @admin.action(description="Exporter la sélection en CSV")
    def export_csv(self, request, queryset):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="soutiens.csv"'
        response.write("﻿")
        writer = csv.writer(response, delimiter=";")
        writer.writerow(["Prénom", "Nom", "E-mail", "Téléphone", "Pays", "Ville",
                         "Aide inscription", "Rappels", "Bénévole", "Date"])
        for s in queryset:
            writer.writerow([s.first_name, s.last_name, s.email, s.phone, s.get_country_display(), s.city,
                             s.wants_registration_help, s.wants_reminders, s.wants_to_volunteer,
                             s.created_at.strftime("%Y-%m-%d")])
        return response


@admin.register(FriendSite)
class FriendSiteAdmin(admin.ModelAdmin):
    list_display = ["name", "url", "order", "is_active"]
    list_editable = ["order", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name", "url"]


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ["__str__", "network", "url", "order", "is_active"]
    list_editable = ["order", "is_active"]
    list_filter = ["network", "is_active"]
    search_fields = ["label", "url"]


@admin.register(ActionGroup)
class ActionGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "country", "is_active", "updated_at"]
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
