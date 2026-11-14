"""Envoi d'images depuis l'éditeur d'articles (admin Django et espace rédaction du site)."""
import io
import os

from django.core.files.base import ContentFile
from PIL import Image, ImageOps
from rest_framework import serializers, status
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import ArticleImage

MAX_SIDE = 1800  # px : largement suffisant pour une colonne de texte
MAX_BYTES = 10 * 1024 * 1024


class CanWriteArticles(BasePermission):
    message = "Vous n'avez pas le droit d'écrire des articles."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and
                    (user.has_perm("blog.add_article") or user.has_perm("blog.change_article")))


class UploadSerializer(serializers.Serializer):
    image = serializers.ImageField()

    def validate_image(self, value):
        if value.size > MAX_BYTES:
            raise serializers.ValidationError("Image trop lourde (10 Mo maximum).")
        return value


def _shrink(upload):
    """Réoriente et réduit l'image si besoin ; conserve le format (PNG pour la transparence, sinon JPEG)."""
    original = Image.open(upload)
    rotated = original.getexif().get(0x0112, 1) not in (0, 1)  # orientation EXIF
    if not rotated and max(original.size) <= MAX_SIDE and original.format in ("JPEG", "PNG", "WEBP", "GIF"):
        upload.seek(0)
        return ContentFile(upload.read(), name=os.path.basename(upload.name)[-100:])
    img = ImageOps.exif_transpose(original)
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    keep_png = img.mode in ("RGBA", "LA", "P")
    buffer = io.BytesIO()
    if keep_png:
        img.save(buffer, "PNG", optimize=True)
        ext = ".png"
    else:
        img.convert("RGB").save(buffer, "JPEG", quality=85, optimize=True, progressive=True)
        ext = ".jpg"
    name = os.path.splitext(os.path.basename(upload.name))[0][:80] + ext
    return ContentFile(buffer.getvalue(), name=name)


class ArticleImageUploadView(APIView):
    """POST multipart « image » → {"url": "/media/…"}.

    Accepte le jeton du site (espace rédaction) et la session de l'admin Django (avec jeton CSRF).
    """

    authentication_classes = [TokenAuthentication, SessionAuthentication]
    permission_classes = [CanWriteArticles]
    parser_classes = [MultiPartParser]
    throttle_classes = [UserRateThrottle]

    def post(self, request):
        serializer = UploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = _shrink(serializer.validated_data["image"])
        record = ArticleImage(uploaded_by=request.user)
        record.image.save(content.name, content, save=True)
        return Response({"url": record.image.url}, status=status.HTTP_201_CREATED)
