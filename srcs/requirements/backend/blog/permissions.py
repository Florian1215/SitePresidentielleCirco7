from rest_framework.permissions import SAFE_METHODS, BasePermission

# Permissions Django utilisées (attribuables dans /admin, par utilisateur ou par groupe) :
#   blog.add_article          -> écrire un article
#   blog.change_article       -> modifier ses propres articles
#   blog.delete_article       -> supprimer ses propres articles
#   blog.publish_article      -> publier (sinon l'article reste en brouillon)
#   blog.manage_all_articles  -> modifier / supprimer les articles des autres
# Les co-auteur·ices d'un article (champ « signé par ») ont les mêmes droits que son créateur·ice.
# Les super-utilisateur·ices (administrateur·ices principaux) peuvent publier directement, sans validations.


def can_publish_now(user):
    return bool(user and user.is_authenticated and user.is_superuser)


def can_manage_all(user):
    return user.has_perm("blog.manage_all_articles")


class ArticlePermission(BasePermission):
    message = "Vous n'avez pas les droits nécessaires pour cette action."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if view.action == "create":
            return user.has_perm("blog.add_article")
        return True  # vérification fine dans has_object_permission

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        owns = obj.is_signed_by(user)
        if request.method == "DELETE":
            return user.has_perm("blog.delete_article") and (owns or can_manage_all(user))
        return user.has_perm("blog.change_article") and (owns or can_manage_all(user))


class ModelPermsPermission(BasePermission):
    """Lecture libre ; création / modification / suppression selon les permissions Django du modèle."""

    model_name = ""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        perm = {"POST": "add", "PUT": "change", "PATCH": "change", "DELETE": "delete"}.get(request.method)
        return bool(request.user and request.user.is_authenticated and perm
                    and request.user.has_perm(f"blog.{perm}_{self.model_name}"))


class CategoryPermission(ModelPermsPermission):
    model_name = "category"


class CollectiveAuthorPermission(ModelPermsPermission):
    """Signatures collectives : gérées par les administrateur·ices (permissions blog.*_collectiveauthor)."""

    model_name = "collectiveauthor"
