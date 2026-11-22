"""Droits des admins du site (groupe « Administrateur·ices ») : toutes les permissions du site.

Leur accès à /admin (sans être staff) est ouvert dans core/admin.py, qui y empêche aussi de toucher au staff,
aux super-utilisateur·ices et aux groupes.
"""

from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.models import Permission

#: Applications dont les admins du site ont toutes les permissions (plus la gestion des comptes, page « Membres »).
SITE_APPS = ("blog", "core")
EXTRA_PERMS = ("auth.change_user", "auth.view_user")


class SiteAdminBackend(BaseBackend):
    def get_all_permissions(self, user_obj, obj=None):
        from .members import ADMINS_GROUP

        if not user_obj.is_active or user_obj.is_anonymous or obj is not None:
            return set()
        if not hasattr(user_obj, "_site_admin_perm_cache"):
            perms = set()
            if user_obj.groups.filter(name=ADMINS_GROUP).exists():
                perms = {
                    f"{app}.{codename}"
                    for app, codename in Permission.objects.filter(content_type__app_label__in=SITE_APPS)
                    .values_list("content_type__app_label", "codename")
                }
                perms.update(EXTRA_PERMS)
            user_obj._site_admin_perm_cache = perms
        return user_obj._site_admin_perm_cache

    def has_module_perms(self, user_obj, app_label):
        """Sans cette méthode (absente de BaseBackend), Django ignore ce backend pour l'accès aux applications :
        l'index de /admin et les pages des modèles restaient vides / interdits aux admins du site."""
        return any(perm.split(".", 1)[0] == app_label for perm in self.get_all_permissions(user_obj))
