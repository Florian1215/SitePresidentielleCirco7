"""Gestion des membres depuis le site (page « Membres ») : demandes de compte, rôles, accès."""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .emails import notify_account_accepted

User = get_user_model()

#: Membres (ancien rôle « Animateur·ice », avant « Rédacteur·ice ») : écrivent et valident des articles, et
#: modifient la page de leur groupe d'action (celui de leur profil) : réseaux sociaux, lien « Je m'engage », photos…
ANIMATORS_GROUP = "Membres"
#: Gestionnaires de groupe d'action : les droits des membres, et en plus ils acceptent ou refusent les demandes de
#: compte des personnes de leur groupe (comme membre ou relecteur·ice).
MANAGERS_GROUP = "Gestionnaires de GA"
REVIEWERS_GROUP = "Relecteur·ices"
#: Ancien rôle (modifier les articles des autres), encore affiché pour les comptes qui l'ont.
EDITORS_GROUP = "Éditeur·ices"
#: Admins du site : tous les droits sur le site (articles, publication directe, membres, catégories, trackers…) et
#: accès à /admin, mais sans pouvoir nommer d'admins ni de staff (réservé au staff et aux super-utilisateur·ices).
ADMINS_GROUP = "Administrateur·ices"
#: Rôle → groupe Django.
ROLE_GROUPS = {"admin": ADMINS_GROUP, "manager": MANAGERS_GROUP, "animator": ANIMATORS_GROUP, "reviewer": REVIEWERS_GROUP}
#: Rôles attribuables depuis la page « Membres ».
ROLES = ("admin", "manager", "animator", "reviewer")
#: Rôles qu'un·e gestionnaire de groupe peut donner en acceptant une demande.
MANAGER_ROLES = ("animator", "reviewer")


def is_site_admin(user):
    """Admin du site (groupe « Administrateur·ices ») ou super-utilisateur·ice."""
    if not (user and user.is_authenticated and user.is_active):
        return False
    return user.is_superuser or any(g.name == ADMINS_GROUP for g in user.groups.all())


def is_animator(user):
    """Membre d'un groupe d'action (rôle « Membre » ou « Gestionnaire du GA »)."""
    return bool(user and user.is_authenticated and user.is_active
                and any(g.name in (ANIMATORS_GROUP, MANAGERS_GROUP) for g in user.groups.all()))


def is_manager(user):
    """Gestionnaire d'un groupe d'action (il faut aussi un groupe dans son profil pour gérer des demandes)."""
    return bool(user and user.is_authenticated and user.is_active
                and any(g.name == MANAGERS_GROUP for g in user.groups.all()))


def user_action_group(user):
    """Groupe d'action du profil du compte (None : aucun, ou compte créé avant les profils)."""
    profile = getattr(user, "profile", None) if user and user.is_authenticated else None
    return profile.action_group if profile else None


def can_edit_group(user, group):
    """Modifier la page d'un groupe d'action : admins du site (tous les groupes), membres (le leur)."""
    if is_site_admin(user):
        return True
    own = user_action_group(user)
    return bool(own and own.pk == group.pk and is_animator(user))


def can_grant_admin(user):
    """Seul·es les membres du staff (accès à /admin) nomment ou retirent les admins du site."""
    return bool(user and user.is_authenticated and user.is_active and user.is_staff)


def can_manage_members(user):
    return bool(user and user.is_authenticated and (
        is_site_admin(user) or can_grant_admin(user) or user.has_perm("auth.change_user")))


def managed_group(user):
    """Groupe d'action dont le compte gère les demandes (gestionnaire), sinon None."""
    return user_action_group(user) if is_manager(user) else None


def can_manage_requests(user):
    """Page « Membres » : admins (tous les comptes) et gestionnaires de GA (les demandes de leur groupe)."""
    return can_manage_members(user) or managed_group(user) is not None


def can_use_trackers(user):
    """Page « Trackers » : admins et membres (rôle « Membre »)."""
    return can_manage_members(user) or is_animator(user)


class CanUseTrackers(BasePermission):
    message = "Les trackers sont réservés aux membres et aux administrateur·ices."

    def has_permission(self, request, view):
        return can_use_trackers(request.user)


class CanManageRequests(BasePermission):
    message = "Seul·es les administrateur·ices et les gestionnaires de groupe d'action gèrent les demandes."

    def has_permission(self, request, view):
        return can_manage_requests(request.user)


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
    names = {g.name for g in user.groups.all()}
    if user.is_superuser or ADMINS_GROUP in names:
        return "admin"
    if EDITORS_GROUP in names:
        return "editor"
    if MANAGERS_GROUP in names:
        return "manager"
    if ANIMATORS_GROUP in names:
        return "animator"
    if REVIEWERS_GROUP in names:
        return "reviewer"
    return "none"


def member_payload(user, me):
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.get_username(),
        "email": user.email,
        "status": member_status(user),
        "role": member_role(user),
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "date_joined": user.date_joined,
        "last_login": user.last_login,
        "is_self": user.pk == me.pk,
        "editable": is_editable(user, me),
        "action_group": member_action_group(user),
    }


def member_action_group(user):
    profile = getattr(user, "profile", None)  # comptes créés avant les profils : aucun
    group = profile.action_group if profile else None
    return {"id": group.id, "name": group.name, "city": group.city, "country": group.country} if group else None


#: Chargement des comptes avec leurs rôles et leur groupe d'action
MEMBERS_QS = User.objects.select_related("profile__action_group").prefetch_related("groups")


def is_editable(user, me):
    """On ne se modifie pas soi-même ; seul le staff touche aux admins et au staff ;
    seul·e un·e super-utilisateur·ice touche aux super-utilisateur·ices."""
    if user.pk == me.pk:
        return False
    if not can_manage_members(me):
        # Gestionnaire de GA : seulement les demandes en attente de son groupe
        own = managed_group(me)
        profile = getattr(user, "profile", None)
        return bool(own and profile and profile.action_group_id == own.pk and member_status(user) == "pending")
    if user.is_superuser and not me.is_superuser:
        return False
    if (user.is_staff or member_role(user) == "admin") and not can_grant_admin(me):
        return False
    return True


def check_role(role, me):
    """Message d'erreur si `me` ne peut pas attribuer ce rôle, sinon None."""
    if role not in ROLES:
        return "Rôle inconnu."
    if not can_manage_members(me) and role not in MANAGER_ROLES:
        return "Un·e gestionnaire de groupe accepte une personne comme membre ou relecteur·ice."
    if role == "admin" and not can_grant_admin(me):
        return "Seul·es les membres du staff peuvent nommer un·e administrateur·ice."
    return None


def set_role(user, role):
    """Un seul rôle à la fois : on retire les autres groupes de rôle avant d'appliquer le nouveau.
    Le statut staff / super-utilisateur·ice (accès à /admin) ne se gère que dans l'administration Django."""
    groups = [Group.objects.get_or_create(name=name)[0] for name in (*ROLE_GROUPS.values(), EDITORS_GROUP)]
    user.groups.remove(*groups)
    if role in ROLE_GROUPS:
        user.groups.add(Group.objects.get(name=ROLE_GROUPS[role]))


class MembersView(APIView):
    permission_classes = [IsAuthenticated, CanManageRequests]

    def get(self, request):
        users = MEMBERS_QS.order_by("-date_joined")
        if not can_manage_members(request.user):
            # Gestionnaire de GA : les comptes de son groupe (demandes à traiter, et membres en lecture seule)
            users = users.filter(profile__action_group=managed_group(request.user))
        return Response([member_payload(u, request.user) for u in users])


class MemberView(APIView):
    """Actions sur un compte : POST {"action": "accept" | "revoke" | "restore", "role"?}, PATCH {"role"}, DELETE (refus)."""

    permission_classes = [IsAuthenticated, CanManageRequests]

    def _get(self, request, pk):
        user = get_object_or_404(MEMBERS_QS, pk=pk)
        if not member_payload(user, request.user)["editable"]:
            return None
        return user

    def _ok(self, request, pk):
        user = MEMBERS_QS.get(pk=pk)
        return Response(member_payload(user, request.user))

    def _forbidden(self):
        return Response({"detail": "Vous ne pouvez pas modifier ce compte."}, status=status.HTTP_403_FORBIDDEN)

    def post(self, request, pk):
        user = self._get(request, pk)
        if user is None:
            return self._forbidden()
        action = request.data.get("action")
        if action != "accept" and not can_manage_members(request.user):
            return self._forbidden()
        if action == "accept":
            role = request.data.get("role", "animator")
            problem = check_role(role, request.user)
            if problem:
                return Response({"detail": problem}, status=status.HTTP_400_BAD_REQUEST)
            was_pending = member_status(user) == "pending"
            set_role(user, role)
            user.is_active = True
            if was_pending:
                notify_account_accepted(user, request)
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
        if user is None or not can_manage_members(request.user):
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


class MemberResetLinkView(APIView):
    """Lien de réinitialisation du mot de passe, créé par un·e admin et transmis par lui ou elle à la personne.

    Le lien (identifiant + code) est signé avec la clé secrète du site : il expire après PASSWORD_RESET_TIMEOUT
    et ne sert qu'une fois (le code ne correspond plus dès que le mot de passe a changé).
    """

    permission_classes = [IsAuthenticated, CanManageMembers]

    def post(self, request, pk):
        user = get_object_or_404(MEMBERS_QS, pk=pk)
        if not member_payload(user, request.user)["editable"]:
            return Response({"detail": "Vous ne pouvez pas modifier ce compte."}, status=status.HTTP_403_FORBIDDEN)
        if not user.is_active:
            return Response({"detail": "Ce compte n'est pas actif : acceptez-le ou rétablissez son accès d'abord."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": default_token_generator.make_token(user),
            "valid_days": settings.PASSWORD_RESET_TIMEOUT // 86400,
        })
