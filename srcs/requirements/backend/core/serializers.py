from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.text import slugify
from rest_framework import serializers

from .models import COUNTRIES, ActionGroup, ActionGroupLink, FaqEntry, FriendSite, MemberProfile, PollingStation, SocialLink

User = get_user_model()


def users_named(first_name, last_name):
    """Comptes portant ce prénom et ce nom (sans tenir compte de la casse ni des espaces autour)."""
    return User.objects.filter(first_name__iexact=first_name.strip(), last_name__iexact=last_name.strip())


class LoginSerializer(serializers.Serializer):
    """Connexion avec prénom, nom et mot de passe."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        password = attrs["password"]
        for candidate in users_named(attrs["first_name"], attrs["last_name"]):
            if not candidate.check_password(password):
                continue
            if not candidate.is_active:
                raise serializers.ValidationError(
                    "Votre compte est en attente de validation par un·e administrateur·ice.", code="pending"
                )
            user = authenticate(self.context["request"], username=candidate.get_username(), password=password)
            if user:
                attrs["user"] = user
                return attrs
        raise serializers.ValidationError("Prénom, nom ou mot de passe incorrect.")


class RegisterSerializer(serializers.Serializer):
    """Demande de création de compte : le compte reste inactif jusqu'à sa validation dans l'admin."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    #: Groupe d'action dont la personne fait partie (obligatoire)
    action_group = serializers.PrimaryKeyRelatedField(
        queryset=ActionGroup.objects.filter(is_active=True),
        error_messages={"required": "Choisissez votre groupe d'action.", "null": "Choisissez votre groupe d'action."},
    )

    def validate(self, attrs):
        attrs["first_name"] = " ".join(attrs["first_name"].split())
        attrs["last_name"] = " ".join(attrs["last_name"].split())
        if users_named(attrs["first_name"], attrs["last_name"]).exists():
            raise serializers.ValidationError(
                "Un compte existe déjà à ce nom. Connectez-vous, ou contactez l'équipe si ce n'est pas le vôtre."
            )
        user = User(first_name=attrs["first_name"], last_name=attrs["last_name"])
        try:
            validate_password(attrs["password"], user)
        except DjangoValidationError as err:
            raise serializers.ValidationError(list(err.messages))
        return attrs

    def create(self, validated_data):
        base = ".".join(filter(None, (slugify(validated_data[k]) for k in ("first_name", "last_name"))))[:140] or "compte"
        username, n = base, 2
        while User.objects.filter(username=username).exists():
            username, n = f"{base}.{n}", n + 1
        user = User(
            username=username,
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            is_active=False,
        )
        user.set_password(validated_data["password"])
        user.save()
        MemberProfile.objects.create(user=user, action_group=validated_data["action_group"])
        return user


class ActionGroupLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionGroupLink
        fields = ["network", "url", "show_in_list"]


class ActionGroupSerializer(serializers.ModelSerializer):
    links = ActionGroupLinkSerializer(many=True, read_only=True)
    #: Ville de l'agenda auquel s'abonner, et son identifiant dans l'adresse du calendrier (/api/agenda/<slug>.ics).
    calendar_city = serializers.CharField(read_only=True, allow_null=True)
    calendar_slug = serializers.SerializerMethodField()

    class Meta:
        model = ActionGroup
        fields = ["id", "name", "city", "country", "latitude", "longitude", "url", "links", "calendar_city", "calendar_slug"]

    def get_calendar_slug(self, obj):
        from .agenda import city_slug

        return city_slug(obj.calendar_city) if obj.calendar_city else None


class FaqEntrySerializer(serializers.ModelSerializer):
    """Question et réponse dans les trois langues ; le site choisit selon la langue affichée."""

    class Meta:
        model = FaqEntry
        fields = ["id", "question_fr", "answer_fr", "question_en", "answer_en", "question_de", "answer_de"]


class PollingStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollingStation
        fields = ["id", "name", "address", "city", "country", "latitude", "longitude", "info", "url"]


class FriendSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = FriendSite
        fields = ["id", "name", "url"]


class SocialLinkSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()

    class Meta:
        model = SocialLink
        fields = ["id", "network", "label", "url"]

    def get_label(self, obj):
        # Nom du réseau (le champ « intitulé » a été supprimé)
        return obj.get_network_display()


def countries_payload():
    return [{"code": code, "name": name} for code, name in COUNTRIES]
