"""Droits des admins du site (groupe « Administrateur·ices ») : toutes les permissions du site.

Leur accès à /admin (sans être staff) est ouvert dans core/admin.py, qui y empêche aussi de toucher au staff,
aux super-utilisateur·ices et aux groupes.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import BaseBackend, ModelBackend
from django.db.models import Q
from django.contrib.auth.models import Permission

#: Applications dont les admins du site ont toutes les permissions (plus la gestion des comptes, page « Membres »).
SITE_APPS = ("blog", "core")
EXTRA_PERMS = ("auth.change_user", "auth.view_user")


def users_for_login(identifier):
    """Comptes correspondant à l'identifiant de connexion : l'email (sans tenir compte de la casse), ou le nom
    d'utilisateur pour les anciens comptes créés sans email (ex. le super-utilisateur du premier démarrage)."""
    identifier = (identifier or "").strip()
    if not identifier:
        return get_user_model().objects.none()
    return get_user_model().objects.filter(Q(email__iexact=identifier) | Q(username=identifier, email=""))


class EmailBackend(ModelBackend):
    """Connexion par email et mot de passe, sur le site comme dans /admin (remplace ModelBackend, dont il garde
    les permissions). Le champ « username » des formulaires Django reçoit l'email."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(get_user_model().USERNAME_FIELD)
        if username is None or password is None:
            return None
        for user in users_for_login(username):
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        get_user_model()().set_password(password)  # même durée qu'un compte existant (pas d'énumération des comptes)
        return None


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
