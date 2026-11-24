"""Page d'un groupe d'action (/groupes/<id>) : lecture publique, modification par ses membres et les admins.

GET    /api/action-groups/<id|slug>/            fiche complète (réseaux, présentation, photos, événements à venir…)
PATCH  /api/action-groups/<id>/                 {description?, links?, engage_url?, engage_label_fr|en|de?}
POST   /api/action-groups/<id>/photos/          multipart {image, caption?}
PUT    /api/action-groups/<id>/logo/            multipart {image} ; DELETE : retire le logo
PUT    /api/action-groups/<id>/cover/           multipart {image} ; DELETE : retire l'image d'en-tête
DELETE /api/action-groups/<id>/photos/<pid>/
POST   /api/action-groups/<id>/visit/           {lang, referrer?, utm_source?} : visite de la page (public)

Le lien « Je m'engage » est celui de la ville de l'agenda du groupe (Formulaires « Je m'engage », page « Je soutiens ») :
les groupes d'une même ville partagent donc ce lien.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from blog.images import UploadSerializer, _shrink, shrink_logo

from .members import can_edit_group
from .models import (
    TRACKER_LANGS, ActionGroup, ActionGroupLink, ActionGroupPhoto, GroupVisit, SignupForm, SocialLink, ZetkinEvent,
)
from .serializers import ActionGroupSerializer
from .trackers import classify_source

MAX_PHOTOS = 30
MAX_LINKS = 15
NETWORKS = {code for code, _ in SocialLink.NETWORKS}


def photo_payload(photo):
    return {"id": photo.id, "url": photo.image.url, "caption": photo.caption, "created_at": photo.created_at}


def engage_form(group):
    """Formulaire « Je m'engage » de la ville du groupe (None si pas de ville, ou pas de formulaire pour elle)."""
    city = group.calendar_city
    return SignupForm.objects.filter(city__iexact=city).first() if city else None


def group_payload(group, user):
    can_edit = bool(user and user.is_authenticated and can_edit_group(user, group))
    data = ActionGroupSerializer(group).data
    form = engage_form(group)
    default = SignupForm.objects.filter(city=SignupForm.DEFAULT).values_list("url", flat=True).first()
    city = group.calendar_city
    events = ZetkinEvent.objects.upcoming().filter(city__iexact=city)[:12] if city else []
    data.update({
        "description": group.description,
        "logo": group.logo.url if group.logo else None,
        "cover": group.cover.url if group.cover else None,
        "photos": [photo_payload(p) for p in group.photos.all()],
        "events": [e.as_dict() for e in events],
        # Lien du bouton « Je m'engage » : celui de la ville, sinon le formulaire par défaut
        "engage_url": form.url if form else default,
        "engage_url_is_default": form is None,
        # Texte du bouton dans chaque langue (vide : « Je m'engage », traduit par le site)
        "engage_label_fr": group.engage_label_fr,
        "engage_label_en": group.engage_label_en,
        "engage_label_de": group.engage_label_de,
        "can_edit": can_edit,
        # Visites de la page : seulement pour qui peut la modifier (panneau « QR code »)
        "visits": visits_payload(group) if can_edit else None,
    })
    return data


def visits_payload(group):
    now = timezone.now()
    visits = GroupVisit.objects.filter(group=group)
    by_lang = dict(visits.values_list("lang").annotate(n=Count("id")))
    return {
        "total": visits.count(),
        "last_7_days": visits.filter(created_at__gte=now - timedelta(days=7)).count(),
        "last_30_days": visits.filter(created_at__gte=now - timedelta(days=30)).count(),
        "by_lang": {code: by_lang.get(code, 0) for code, _ in TRACKER_LANGS},
    }


class LinkSerializer(serializers.Serializer):
    network = serializers.ChoiceField(choices=sorted(NETWORKS))
    url = serializers.URLField(max_length=200)
    show_in_list = serializers.BooleanField(default=True)


class GroupUpdateSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=300, allow_blank=True, required=False, trim_whitespace=True)
    links = LinkSerializer(many=True, required=False)
    #: Vide : la ville revient au formulaire par défaut
    engage_url = serializers.URLField(max_length=200, allow_blank=True, required=False)
    #: Texte du bouton « Je m'engage » dans chaque langue (vide : texte par défaut du site)
    engage_label_fr = serializers.CharField(max_length=40, allow_blank=True, required=False, trim_whitespace=True)
    engage_label_en = serializers.CharField(max_length=40, allow_blank=True, required=False, trim_whitespace=True)
    engage_label_de = serializers.CharField(max_length=40, allow_blank=True, required=False, trim_whitespace=True)

    def validate_links(self, value):
        if len(value) > MAX_LINKS:
            raise serializers.ValidationError(f"{MAX_LINKS} réseaux au maximum.")
        return value


def get_group(request, pk, *, edit=False):
    # Identifiant (anciennes adresses /groupes/12, API de modification) ou adresse de la page (/groupes/berlin-insoumise)
    lookup = {"pk": int(pk)} if str(pk).isdigit() else {"slug": pk}
    group = get_object_or_404(ActionGroup.objects.prefetch_related("links", "photos"), **lookup)
    allowed = request.user.is_authenticated and can_edit_group(request.user, group)
    if edit and not allowed:
        return None
    if not group.is_active and not allowed:
        return None
    return group


def forbidden():
    return Response({"detail": "Vous ne pouvez pas modifier ce groupe d'action."}, status=status.HTTP_403_FORBIDDEN)


class ActionGroupDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        group = get_group(request, pk)
        if group is None:
            return Response({"detail": "Groupe introuvable."}, status=status.HTTP_404_NOT_FOUND)
        return Response(group_payload(group, request.user))

    def patch(self, request, pk):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        group = get_group(request, pk, edit=True)
        if group is None:
            return forbidden()
        serializer = GroupUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        city = group.calendar_city
        if "engage_url" in data and not city:
            return Response(
                {"engage_url": ["Ce groupe n'a pas de ville d'agenda : un·e admin doit en choisir une."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if "description" in data:
                group.description = data["description"]
                group.save(update_fields=["description", "updated_at"])
            labels = [f for f in ("engage_label_fr", "engage_label_en", "engage_label_de") if f in data]
            if labels:
                for field in labels:
                    setattr(group, field, data[field])
                group.save(update_fields=[*labels, "updated_at"])
            if "links" in data:
                group.links.all().delete()
                ActionGroupLink.objects.bulk_create(
                    ActionGroupLink(group=group, order=i, **link) for i, link in enumerate(data["links"])
                )
            if "engage_url" in data:
                form = engage_form(group)
                if data["engage_url"]:
                    if form:
                        form.url = data["engage_url"]
                        form.save(update_fields=["url"])
                    else:
                        SignupForm.objects.create(city=city, url=data["engage_url"])
                elif form:
                    form.delete()

        group = get_group(request, pk, edit=True)
        return Response(group_payload(group, request.user))


class ActionGroupPhotosView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    throttle_classes = [UserRateThrottle]

    def post(self, request, pk):
        group = get_group(request, pk, edit=True)
        if group is None:
            return forbidden()
        if group.photos.count() >= MAX_PHOTOS:
            return Response({"detail": f"{MAX_PHOTOS} photos au maximum : supprimez-en d'abord."},
                            status=status.HTTP_400_BAD_REQUEST)
        serializer = UploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = _shrink(serializer.validated_data["image"])
        caption = str(request.data.get("caption") or "").strip()[:200]
        photo = ActionGroupPhoto(group=group, caption=caption, uploaded_by=request.user)
        photo.image.save(content.name, content, save=True)
        return Response(photo_payload(photo), status=status.HTTP_201_CREATED)


class ActionGroupPhotoView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, photo_id):
        group = get_group(request, pk, edit=True)
        if group is None:
            return forbidden()
        get_object_or_404(ActionGroupPhoto, pk=photo_id, group=group).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActionGroupVisitView(APIView):
    """Arrivée sur la page d'un groupe (une fois par onglet, côté site). Les membres du groupe ne sont pas comptés."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "track"

    def post(self, request, pk):
        group = get_object_or_404(ActionGroup, pk=pk, is_active=True)
        if request.user.is_authenticated and can_edit_group(request.user, group):
            return Response(status=status.HTTP_204_NO_CONTENT)
        lang = str(request.data.get("lang") or "").strip().lower()[:2]
        if lang not in {code for code, _ in TRACKER_LANGS}:
            lang = "fr"
        source, _ = classify_source(
            str(request.data.get("referrer") or "")[:2000], str(request.data.get("utm_source") or ""), request.get_host(),
        )
        GroupVisit.objects.create(group=group, lang=lang, source=source)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActionGroupImageView(APIView):
    """Logo ou image d'en-tête du groupe (`field` : « logo » ou « cover ») : ajout, remplacement, suppression."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    throttle_classes = [UserRateThrottle]
    field = "logo"

    def put(self, request, pk):
        group = get_group(request, pk, edit=True)
        if group is None:
            return forbidden()
        serializer = UploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["image"]
        content = shrink_logo(upload) if self.field == "logo" else _shrink(upload)
        image = getattr(group, self.field)
        old = image.name
        image.save(content.name, content, save=False)
        group.save(update_fields=[self.field, "updated_at"])
        if old and old != image.name:
            image.storage.delete(old)
        return Response({self.field: image.url})

    def delete(self, request, pk):
        group = get_group(request, pk, edit=True)
        if group is None:
            return forbidden()
        image = getattr(group, self.field)
        if image:
            image.delete(save=False)
            group.save(update_fields=[self.field, "updated_at"])
        return Response({self.field: None})
