"""Envoi d'images depuis l'éditeur d'articles (admin Django et espace rédaction du site)."""
import io
import os

from django.core.files.base import ContentFile
from PIL import Image, ImageChops, ImageFilter, ImageOps
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


LOGO_MAX_SIDE = 800  # px : un logo n'est jamais affiché plus grand (stickers QR code : 840 px au plus)


def _content_box(img):
    """Cadre du dessin d'un logo, sans ses marges transparentes ou de couleur unie (fond légèrement granuleux toléré).

    None si l'image n'a pas de marge reconnaissable (fond non uni, dessin jusqu'aux bords).
    """
    small = img.copy()
    small.thumbnail((400, 400))
    ratio = img.width / small.width
    alpha = small.getchannel("A")
    w, h = small.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    if all(alpha.getpixel(c) <= 8 for c in corners):
        mask = alpha.point(lambda a: 255 if a > 8 else 0)
    else:
        rgb = small.convert("RGB").filter(ImageFilter.MedianFilter(5))  # efface le grain du fond
        colors = [rgb.getpixel(c) for c in corners]
        bg = tuple(sorted(channel)[1] for channel in zip(*colors))  # couleur médiane des coins
        if sum(max(abs(a - b) for a, b in zip(color, bg)) <= 30 for color in colors) < 3:
            return None  # coins de couleurs différentes : pas de fond uni
        diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, bg)).convert("L")
        mask = diff.point(lambda d: 255 if d > 40 else 0)
    box = mask.getbbox()
    if not box or box == (0, 0, w, h):
        return None
    margin = 0.02 * max(box[2] - box[0], box[3] - box[1])  # un peu d'air autour du dessin
    left, top, right, bottom = box
    return (
        max(0, int((left - margin) * ratio)), max(0, int((top - margin) * ratio)),
        min(img.width, int((right + margin) * ratio)), min(img.height, int((bottom + margin) * ratio)),
    )


def shrink_logo(upload):
    """Logo : réorienté, marges (transparentes ou de couleur unie) retirées, réduit à LOGO_MAX_SIDE px.

    Le dessin occupe ainsi toute sa zone d'affichage (stickers QR code). PNG s'il a de la transparence, sinon JPEG.
    """
    original = Image.open(upload)
    img = ImageOps.exif_transpose(original).convert("RGBA")
    box = _content_box(img)
    rotated = original.getexif().get(0x0112, 1) not in (0, 1)
    if not box and not rotated and max(img.size) <= LOGO_MAX_SIDE and original.format in ("JPEG", "PNG", "WEBP"):
        upload.seek(0)  # déjà serré et léger : gardé tel quel
        return ContentFile(upload.read(), name=os.path.basename(upload.name)[-100:])
    if box:
        img = img.crop(box)
    has_alpha = img.getchannel("A").getextrema()[0] < 255  # transparence réellement utilisée
    img.thumbnail((LOGO_MAX_SIDE, LOGO_MAX_SIDE), Image.LANCZOS)
    buffer = io.BytesIO()
    if has_alpha:
        img.save(buffer, "PNG", optimize=True)
        ext = ".png"
    else:
        img.convert("RGB").save(buffer, "JPEG", quality=90, optimize=True, progressive=True)
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
