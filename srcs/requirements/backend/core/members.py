"""Gestion des membres depuis le site (page « Membres ») : demandes de compte, rôles, accès."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

User = get_user_model()

WRITERS_GROUP = "Rédacteur·ices"
REVIEWERS_GROUP = "Relecteur·ices"
#: Ancien rôle (modifier les articles des autres), encore affiché pour les comptes qui l'ont.
EDITORS_GROUP = "Éditeur·ices"
#: Rôle → groupe Django. « admin » = super-utilisateur·ice (tous les droits, y compris gérer les membres).
ROLE_GROUPS = {"writer": WRITERS_GROUP, "reviewer": REVIEWERS_GROUP}
#: Rôles attribuables depuis la page « Membres ».
ROLES = ("admin", "writer", "reviewer")


def can_manage_members(user):
    return bool(user and user.is_authenticated and (user.is_superuser or user.has_perm("auth.change_user")))


class CanManageMembers(BasePermission):
    message = "Seul·es les administrateur·ices peuvent gérer les membres."

    def has_permission(self, request, view):
        return can_manage_members(request.user)


def member_status(user):
    if user.is_active:
        return "active"
    # Une demande jamais validée n'a jamais servi à se connecter.
    return "pending" if user.last_login is None else "revoked"


def member_role(user):
    if user.is_superuser:
        return "admin"
    names = {g.name for g in user.groups.all()}
    if EDITORS_GROUP in names:
        return "editor"
    if WRITERS_GROUP in names:
        return "writer"
    if REVIEWERS_GROUP in names:
        return "reviewer"
    return "none"


def member_payload(user, me):
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.get_username(),
        "status": member_status(user),
        "role": member_role(user),
        "is_staff": user.is_staff,
        "date_joined": user.date_joined,
        "last_login": user.last_login,
        "is_self": user.pk == me.pk,
        # On ne se modifie pas soi-même, et seul·e un·e super-utilisateur·ice touche aux autres.
        "editable": user.pk != me.pk and (me.is_superuser or not user.is_superuser),
    }


def check_role(role, me):
    """Message d'erreur si `me` ne peut pas attribuer ce rôle, sinon None."""
    if role not in ROLES:
        return "Rôle inconnu."
    if role == "admin" and not me.is_superuser:
        return "Seul·es les administrateur·ices peuvent nommer un·e administrateur·ice."
    return None


def set_role(user, role):
    """Un seul rôle à la fois : on retire les autres groupes de rôle (et le statut d'admin) avant d'appliquer le nouveau."""
    groups = [Group.objects.get_or_create(name=name)[0] for name in (*ROLE_GROUPS.values(), EDITORS_GROUP)]
    user.groups.remove(*groups)
    is_admin = role == "admin"
    if user.is_superuser != is_admin:
        user.is_superuser = is_admin
        user.is_staff = is_admin  # accès à l'administration Django
        user.save(update_fields=["is_superuser", "is_staff"])
    if role in ROLE_GROUPS:
        user.groups.add(Group.objects.get(name=ROLE_GROUPS[role]))


class MembersView(APIView):
    permission_classes = [IsAuthenticated, CanManageMembers]

    def get(self, request):
        users = User.objects.prefetch_related("groups").order_by("-date_joined")
        return Response([member_payload(u, request.user) for u in users])


class MemberView(APIView):
    """Actions sur un compte : POST {"action": "accept" | "revoke" | "restore", "role"?}, PATCH {"role"}, DELETE (refus)."""

    permission_classes = [IsAuthenticated, CanManageMembers]

    def _get(self, request, pk):
        user = get_object_or_404(User.objects.prefetch_related("groups"), pk=pk)
        if not member_payload(user, request.user)["editable"]:
            return None
        return user

    def _ok(self, request, pk):
        user = User.objects.prefetch_related("groups").get(pk=pk)
        return Response(member_payload(user, request.user))

    def _forbidden(self):
        return Response({"detail": "Vous ne pouvez pas modifier ce compte."}, status=status.HTTP_403_FORBIDDEN)

    def post(self, request, pk):
        user = self._get(request, pk)
        if user is None:
            return self._forbidden()
        action = request.data.get("action")
        if action == "accept":
            role = request.data.get("role", "writer")
            problem = check_role(role, request.user)
            if problem:
                return Response({"detail": problem}, status=status.HTTP_400_BAD_REQUEST)
            set_role(user, role)
            user.is_active = True
        elif action == "restore":
            user.is_active = True
        elif action == "revoke":
            user.is_active = False
            Token.objects.filter(user=user).delete()  # déconnecte immédiatement
        else:
            return Response({"detail": "Action inconnue."}, status=status.HTTP_400_BAD_REQUEST)
        user.save(update_fields=["is_active"])
        return self._ok(request, pk)

    def patch(self, request, pk):
        user = self._get(request, pk)
        if user is None:
            return self._forbidden()
        role = request.data.get("role")
        problem = check_role(role, request.user)
        if problem:
            return Response({"detail": problem}, status=status.HTTP_400_BAD_REQUEST)
        set_role(user, role)
        return self._ok(request, pk)

    def delete(self, request, pk):
        """Refus d'une demande de compte : seules les demandes jamais validées sont supprimées."""
        user = self._get(request, pk)
        if user is None:
            return self._forbidden()
        if member_status(user) != "pending" or user.articles.exists():
            return Response({"detail": "Seule une demande en attente peut être refusée ; retirez plutôt l'accès."},
                            status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
