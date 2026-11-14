from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import ActionGroup, FriendSite, PollingStation, SocialLink, Supporter
from .action_populaire import supporters_count
from .zetkin import upcoming_events
from .serializers import (
    ActionGroupSerializer,
    PollingStationSerializer,
    ContactMessageSerializer,
    FriendSiteSerializer,
    LoginSerializer,
    SocialLinkSerializer,
    SupporterSerializer,
    countries_payload,
)


def user_payload(user):
    return {
        "id": user.id,
        "username": user.get_username(),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_staff": user.is_staff,
        "permissions": sorted(user.get_all_permissions()),
    }


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


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(user_payload(request.user))


class CountriesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(countries_payload())


class SupportersCountView(APIView):
    """Nombre de soutiens à la candidature de Jean-Luc Mélenchon (Action populaire)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"count": supporters_count()})


class EventsView(APIView):
    """Prochains événements de la campagne, lus dans le calendrier Zetkin."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(upcoming_events())


class ActionGroupsView(APIView):
    """Groupes d'action affichés sur la carte de la circonscription."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(ActionGroupSerializer(ActionGroup.objects.filter(is_active=True), many=True).data)


class PollingStationsView(APIView):
    """Bureaux de vote affichés sur la carte de la page « Voter »."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(PollingStationSerializer(PollingStation.objects.filter(is_active=True), many=True).data)


class FooterLinksView(APIView):
    """Sites amis et réseaux sociaux du pied de page, gérés depuis l'admin."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({
            "friend_sites": FriendSiteSerializer(FriendSite.objects.filter(is_active=True), many=True).data,
            "socials": SocialLinkSerializer(SocialLink.objects.filter(is_active=True), many=True).data,
        })


class ContactView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_forms"

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Merci, votre message a bien été envoyé."}, status=status.HTTP_201_CREATED)


class SupporterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_forms"

    def post(self, request):
        serializer = SupporterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        # Si l'adresse est déjà connue, on ne modifie rien (personne ne peut écraser
        # les données d'un·e autre) et on répond de la même façon.
        created = False
        if not Supporter.objects.filter(email__iexact=email).exists():
            serializer.save(email=email)
            created = True
        return Response(
            {"detail": "Merci ! Votre inscription est bien enregistrée."},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
