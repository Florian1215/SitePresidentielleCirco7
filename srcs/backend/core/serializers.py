from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import COUNTRIES, ActionGroup, ContactMessage, FriendSite, SocialLink, Supporter


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        user = authenticate(self.context["request"], username=attrs["username"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Identifiant ou mot de passe incorrect.")
        attrs["user"] = user
        return attrs


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["name", "email", "country", "subject", "message"]


class SupporterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supporter
        fields = [
            "first_name", "last_name", "email", "phone", "country", "city",
            "wants_registration_help", "wants_reminders", "wants_to_volunteer", "consent",
        ]
        # L'unicité est gérée dans la vue (mise à jour si l'e-mail existe déjà).
        extra_kwargs = {"email": {"validators": []}}

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError("Votre consentement est nécessaire pour enregistrer vos données.")
        return value


class ActionGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionGroup
        fields = ["id", "name", "city", "country", "latitude", "longitude", "url"]


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
        return str(obj)


def countries_payload():
    return [{"code": code, "name": name} for code, name in COUNTRIES]
