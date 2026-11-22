"""Visites et trackers (page « Trackers », administrateur·ices).

Le site appelle `POST /api/track/` à chaque arrivée d'une personne (une fois par onglet, plus à chaque arrivée
par un lien de suivi ou depuis un autre site), avec :
  - `code` : identifiant du tracker si l'adresse en contient un (`https://site/?lang=fr&t=<identifiant>`) ;
  - `lang` : langue du lien (ou langue du site) ;
  - `referrer` : page d'où vient la personne (fournie par le navigateur, souvent réduite au nom du site) ;
  - `utm_source` : paramètre ajouté par certains sites à leurs liens (ChatGPT : `utm_source=chatgpt.com`).
L'origine est rangée sous un nom lisible (Google, ChatGPT, Facebook…) ; sinon, le nom du site.
"""

import re
import secrets
from datetime import timedelta
from urllib.parse import urlsplit

from django.db.models import Count, Max, Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .members import CanManageMembers
from .models import TRACKER_LANGS, Tracker, Visit

LANG_CODES = [code for code, _ in TRACKER_LANGS]
#: Sans caractères qui se confondent (0/o, 1/l/i) : l'identifiant peut être recopié à la main.
CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
CODE_LENGTH = 8


#: Nom lisible de l'origine, d'après le site (expression régulière sur le nom de domaine, sans « www. »).
#: Les premiers motifs l'emportent : gemini.google.com → Gemini avant google.* → Google.
KNOWN_SOURCES = [
    (r"(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$|^chatgpt$", "ChatGPT"),
    (r"(^|\.)perplexity\.ai$|^perplexity$", "Perplexity"),
    (r"(^|\.)claude\.ai$|^claude$", "Claude"),
    (r"^gemini\.google\.com$|^(bard|gemini)$", "Gemini"),
    (r"(^|\.)copilot\.microsoft\.com$|^copilot$", "Copilot"),
    (r"(^|\.)(mistral\.ai)$|^(le-?chat|mistral)$", "Le Chat (Mistral)"),
    (r"(^|\.)deepseek\.com$|^deepseek$", "DeepSeek"),
    (r"(^|\.)google\.[a-z.]+$|^google$|^android-app:\/\/com\.google", "Google"),
    (r"(^|\.)bing\.com$|^bing$", "Bing"),
    (r"(^|\.)duckduckgo\.com$|^duckduckgo$", "DuckDuckGo"),
    (r"(^|\.)qwant\.com$|^qwant$", "Qwant"),
    (r"(^|\.)ecosia\.org$|^ecosia$", "Ecosia"),
    (r"(^|\.)(yahoo\.[a-z.]+)$|^yahoo$", "Yahoo"),
    (r"(^|\.)(yandex\.[a-z.]+)$|^yandex$", "Yandex"),
    (r"(^|\.)brave\.com$|^brave$", "Brave Search"),
    (r"(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$|^(facebook|fb)$", "Facebook"),
    (r"(^|\.)instagram\.com$|^(instagram|ig)$", "Instagram"),
    (r"(^|\.)(t\.co|twitter\.com|x\.com)$|^(twitter|x)$", "X (Twitter)"),
    (r"(^|\.)(bsky\.app|bsky\.social)$|^(bluesky|bsky)$", "Bluesky"),
    (r"(^|\.)threads\.(net|com)$|^threads$", "Threads"),
    (r"(^|\.)(linkedin\.com|lnkd\.in)$|^linkedin$", "LinkedIn"),
    (r"(^|\.)(youtube\.com|youtu\.be)$|^youtube$", "YouTube"),
    (r"(^|\.)tiktok\.com$|^tiktok$", "TikTok"),
    (r"(^|\.)reddit\.com$|^reddit$", "Reddit"),
    (r"(^|\.)(linktr\.ee|linktree\.com)$|^linktree$", "Linktree"),
    (r"(^|\.)(whatsapp\.com|wa\.me)$|^whatsapp$", "WhatsApp"),
    (r"(^|\.)(t\.me|telegram\.org|telegram\.me)$|^telegram$", "Telegram"),
    (r"(^|\.)signal\.(org|me)$|^signal$", "Signal"),
    (r"(^|\.)(mail\.google\.com|outlook\.(live|office)\.com|mail\.yahoo\.com|mail\.proton\.me)$|^(email|newsletter|mail)$", "E-mail"),
    (r"(^|\.)actionpopulaire\.fr$", "Action populaire"),
    (r"(^|\.)(lafranceinsoumise\.fr|melenchon2027\.fr|jlm27\.fr)$", "Sites LFI"),
]
_KNOWN = [(re.compile(pattern), label) for pattern, label in KNOWN_SOURCES]


def classify_source(referrer, utm_source, own_host):
    """(origine lisible, nom du site d'origine). Origine vide = accès direct."""
    host = ""
    if referrer:
        try:
            host = (urlsplit(referrer).hostname or "").lower()
        except ValueError:
            host = ""
        if host.startswith("www."):
            host = host[4:]
        own = (own_host or "").split(":")[0].lower().removeprefix("www.")
        if host and host == own:
            host = ""  # navigation à l'intérieur du site
    utm = (utm_source or "").strip().lower()[:100]
    for candidate in (utm, host):
        if not candidate:
            continue
        for pattern, label in _KNOWN:
            if pattern.search(candidate):
                return label, host
    if utm:
        return utm.removeprefix("www.")[:60], host
    return host[:60], host


def new_code():
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        if not Tracker.objects.filter(code=code).exists():
            return code


def trackers_with_counts():
    counts = {f"count_{lang}": Count("visits", filter=Q(visits__lang=lang)) for lang in LANG_CODES}
    return Tracker.objects.annotate(total=Count("visits"), last_visit=Max("visits__created_at"), **counts)


def tracker_payload(tracker):
    return {
        "id": tracker.id,
        "name": tracker.name,
        "code": tracker.code,
        "created_at": tracker.created_at,
        "total": tracker.total,
        "counts": {lang: getattr(tracker, f"count_{lang}") for lang in LANG_CODES},
        "last_visit": tracker.last_visit,
    }


class TrackersView(APIView):
    permission_classes = [CanManageMembers]

    def get(self, request):
        return Response([tracker_payload(t) for t in trackers_with_counts()])

    def post(self, request):
        name = str(request.data.get("name", "")).strip()
        if not name:
            return Response({"name": ["Donnez un nom au tracker."]}, status=status.HTTP_400_BAD_REQUEST)
        if len(name) > 120:
            return Response({"name": ["120 caractères au maximum."]}, status=status.HTTP_400_BAD_REQUEST)
        tracker = Tracker.objects.create(name=name, code=new_code(), created_by=request.user)
        return Response(tracker_payload(trackers_with_counts().get(pk=tracker.pk)), status=status.HTTP_201_CREATED)


class TrackerView(APIView):
    permission_classes = [CanManageMembers]

    def patch(self, request, pk):
        tracker = get_object_or_404(Tracker, pk=pk)
        name = str(request.data.get("name", "")).strip()
        if not name or len(name) > 120:
            return Response({"name": ["Nom invalide (1 à 120 caractères)."]}, status=status.HTTP_400_BAD_REQUEST)
        tracker.name = name
        tracker.save(update_fields=["name"])
        return Response(tracker_payload(trackers_with_counts().get(pk=pk)))

    def delete(self, request, pk):
        get_object_or_404(Tracker, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VisitStatsView(APIView):
    """Nombre total de visites, par langue et par origine (page « Trackers »)."""

    permission_classes = [CanManageMembers]

    def get(self, request):
        now = timezone.now()
        visits = Visit.objects.all()
        untracked = visits.filter(tracker__isnull=True)
        by_lang = dict(visits.values_list("lang").annotate(n=Count("id")))
        sources = (
            untracked.exclude(source="").values("source").annotate(count=Count("id")).order_by("-count", "source")[:30]
        )
        return Response(
            {
                "total": visits.count(),
                "today": visits.filter(created_at__gte=now.replace(hour=0, minute=0, second=0, microsecond=0)).count(),
                "last_7_days": visits.filter(created_at__gte=now - timedelta(days=7)).count(),
                "last_30_days": visits.filter(created_at__gte=now - timedelta(days=30)).count(),
                "tracked": visits.filter(tracker__isnull=False).count(),
                "untracked": untracked.count(),
                "direct": untracked.filter(source="").count(),
                "by_lang": {lang: by_lang.get(lang, 0) for lang in LANG_CODES},
                "sources": list(sources),
            }
        )


class TrackView(APIView):
    """Arrivée d'une personne sur le site (public, sans connexion)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "track"

    def post(self, request):
        code = str(request.data.get("code") or "").strip().lower()[:16]
        lang = str(request.data.get("lang") or "").strip().lower()[:2]
        if lang not in LANG_CODES:
            lang = "fr"
        tracker = Tracker.objects.filter(code=code).first() if code else None
        source, host = classify_source(
            str(request.data.get("referrer") or "")[:2000],
            str(request.data.get("utm_source") or ""),
            request.get_host(),
        )
        Visit.objects.create(tracker=tracker, lang=lang, source=source, referrer_host=host[:255])
        return Response(status=status.HTTP_204_NO_CONTENT)
