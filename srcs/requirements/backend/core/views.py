from django.contrib.auth import get_user_model, login as session_login, logout as session_logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .emails import notify_registration
from .members import can_grant_admin, can_manage_members, can_manage_requests, can_use_trackers, is_animator, is_site_admin, user_action_group
from .models import ActionGroup, Announcement, FaqEntry, FriendSite, PollingStation, SignupForm, SocialLink, SupportersCount, ZetkinEvent
from .zetkin import CITIES
from .serializers import (
    ActionGroupSerializer,
    PollingStationSerializer,
    AnnouncementSerializer,
    FaqEntrySerializer,
    FriendSiteSerializer,
    LoginSerializer,
    RegisterSerializer,
    SocialLinkSerializer,
    countries_payload,
)



def user_payload(user):
    return {
        "id": user.id,
        "username": user.get_username(),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        # Admin du site : publication directe des articles (sans accès à /admin s'il ou elle n'est pas staff)
        "is_admin": is_site_admin(user),
        # Nommer ou retirer des admins du site : membres du staff seulement
        "can_grant_admin": can_grant_admin(user),
        "can_manage_members": can_manage_members(user),
        # Page « Membres » limitée aux demandes de son groupe (gestionnaire de GA)
        "can_manage_requests": can_manage_requests(user),
        "can_use_trackers": can_use_trackers(user),
        "permissions": sorted(user.get_all_permissions()),
        # Groupe d'action du compte, et s'il peut en modifier la page (membres ; les admins : tous les groupes)
        "action_group": action_group_payload(user),
    }


def action_group_payload(user):
    group = user_action_group(user)
    if not group:
        return None
    return {"id": group.id, "slug": group.slug, "name": group.name, "can_edit": is_animator(user) or is_site_admin(user)}


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": user_payload(user)})


class RegisterView(APIView):
    """Demande de compte : créé inactif ; les organisateur·ices de son groupe d'action sont prévenu·es
    par email et l'acceptent ou la refusent (page « Membres » ou action « Valider… » dans /admin)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_forms"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        notify_registration(user, serializer.validated_data["action_group"], request)
        return Response(
            {"detail": "Votre demande de compte est enregistrée. Vous recevrez un email dès qu'elle sera validée."},
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        session_logout(request._request)  # ferme aussi la session de /admin ouverte depuis le site
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminSessionView(APIView):
    """Lien « Administration » du site : ouvre la session Django de /admin à partir du jeton du site,
    pour ne pas avoir à se reconnecter. Réservé à qui a accès à /admin (staff ou admins du site).

    Sans risque CSRF : l'authentification se fait par l'en-tête Authorization, pas par un cookie.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .admin import has_admin_access

        if not has_admin_access(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        session_login(request._request, request.user, backend="core.backends.EmailBackend")
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetView(APIView):
    """Page « Nouveau mot de passe » ouverte depuis le lien créé par un·e admin (page Membres).

    GET : vérifie le lien et renvoie le prénom de la personne ; POST {password} : enregistre le nouveau mot de passe.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"
    INVALID = "Ce lien n'est plus valable (déjà utilisé ou expiré). Demandez-en un nouveau à un·e admin."

    def _user(self, uid, token):
        try:
            user = get_user_model().objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
        except (ValueError, TypeError, OverflowError, get_user_model().DoesNotExist):
            return None
        return user if default_token_generator.check_token(user, token) else None

    def get(self, request, uid, token):
        user = self._user(uid, token)
        if user is None:
            return Response({"detail": self.INVALID}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"first_name": user.first_name})

    def post(self, request, uid, token):
        user = self._user(uid, token)
        if user is None:
            return Response({"detail": self.INVALID}, status=status.HTTP_400_BAD_REQUEST)
        password = request.data.get("password") or ""
        try:
            validate_password(password, user)
        except DjangoValidationError as err:
            return Response({"password": list(err.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
        user.save(update_fields=["password"])
        Token.objects.filter(user=user).delete()  # déconnecte les sessions ouvertes avec l'ancien mot de passe
        return Response({"detail": "Mot de passe enregistré."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(user_payload(request.user))


class CountriesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(countries_payload())


class SupportersCountView(APIView):
    """Nombre de soutiens à la candidature de Jean-Luc Mélenchon (dernier relevé horaire d'Action populaire)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"count": SupportersCount.current()})


class EventsView(APIView):
    """Prochains événements de la campagne (table ZetkinEvent, synchronisée avec Zetkin toutes les heures)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response([e.as_dict() for e in ZetkinEvent.objects.upcoming()])


class EngageFormsView(APIView):
    """« Je m'engage » : villes proposées et formulaire Zetkin de chacune (admin → Formulaires « Je m'engage »)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        forms = dict(SignupForm.objects.values_list("city", "url"))
        default = forms.pop(SignupForm.DEFAULT, None)  # null : aucun formulaire par défaut dans l'admin
        # Villes de l'agenda, plus celles saisies librement dans l'admin (même nom à la casse près = même ville)
        by_key = {name.casefold(): url for name, url in forms.items()}
        known = {name.casefold() for name in CITIES}
        names = [*CITIES, *(name for name in forms if name.casefold() not in known)]
        return Response({
            "default_url": default,
            "cities": [{"name": name, "url": by_key.get(name.casefold()) or default} for name in names],
        })


class ActionGroupsView(APIView):
    """Groupes d'action affichés sur la carte de la circonscription."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(ActionGroupSerializer(ActionGroup.objects.filter(is_active=True).prefetch_related("links"), many=True).data)


class PollingStationsView(APIView):
    """Bureaux de vote affichés sur la carte de la page « Voter »."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(PollingStationSerializer(PollingStation.objects.filter(is_active=True), many=True).data)


class AnnouncementsView(APIView):
    """Messages du bandeau défilant en haut du site (admin Django → Messages du bandeau)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(AnnouncementSerializer(Announcement.objects.filter(is_active=True), many=True).data)


class FaqView(APIView):
    """Questions fréquentes de la page « Voter » (admin Django → Questions fréquentes)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(FaqEntrySerializer(FaqEntry.objects.filter(is_active=True), many=True).data)


class FooterLinksView(APIView):
    """Sites amis et réseaux sociaux du pied de page, gérés depuis l'admin."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({
            "friend_sites": FriendSiteSerializer(FriendSite.objects.filter(is_active=True), many=True).data,
            "socials": SocialLinkSerializer(SocialLink.objects.filter(is_active=True), many=True).data,
        })
