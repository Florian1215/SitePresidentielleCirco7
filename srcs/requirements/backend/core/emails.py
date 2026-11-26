"""Emails transactionnels du site, envoyés par l'API Brevo (https://developers.brevo.com/reference/sendtransacemail).

Réglages (srcs/.env) : BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME. Sans clé, aucun email n'est envoyé
(le site fonctionne normalement, un avertissement est écrit dans les logs).

Les envois passent par la tâche Celery core.tasks.send_email (en dehors de la requête, avec nouvelles tentatives),
déclenchée seulement une fois la transaction enregistrée (transaction.on_commit).

  - demande de compte          → email aux gestionnaires du groupe d'action choisi (à défaut : aux admins du site)
  - demande de compte acceptée → email à la personne : elle peut se connecter
"""
import json
import logging
import urllib.error
import urllib.request
from html import escape

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


class EmailError(Exception):
    """Envoi refusé ou impossible (Brevo injoignable, clé invalide…)."""


def brevo_configured():
    return bool(settings.BREVO_API_KEY and settings.BREVO_SENDER_EMAIL)


def send_now(to_email, to_name, subject, text):
    """Envoie un email (texte, et sa version HTML simple) à une personne. Lève EmailError en cas d'échec."""
    html = "".join(f"<p>{escape(p).replace(chr(10), '<br>')}</p>" for p in text.split("\n\n"))
    payload = {
        "sender": {"email": settings.BREVO_SENDER_EMAIL, "name": settings.BREVO_SENDER_NAME or settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, **({"name": to_name} if to_name else {})}],
        "subject": subject,
        "textContent": text,
        "htmlContent": f"<html><body>{html}</body></html>",
    }
    req = urllib.request.Request(
        BREVO_URL,
        data=json.dumps(payload).encode(),
        headers={"api-key": settings.BREVO_API_KEY, "accept": "application/json", "content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except urllib.error.HTTPError as err:
        raise EmailError(f"Brevo HTTP {err.code} : {err.read()[:500]!r}") from err
    except (urllib.error.URLError, TimeoutError, OSError) as err:
        raise EmailError(f"Brevo injoignable : {err}") from err


def queue_email(to_email, to_name, subject, text):
    """Envoi en tâche de fond, après l'enregistrement de la transaction en cours."""
    if not to_email:
        return
    if not brevo_configured():
        logger.warning("Email « %s » non envoyé à %s : BREVO_API_KEY / BREVO_SENDER_EMAIL absents.", subject, to_email)
        return
    from .tasks import send_email

    transaction.on_commit(lambda: send_email.delay(to_email, to_name, subject, text))


def site_url(request=None):
    """Adresse publique du site : DJANGO_SITE_URL, sinon celle de la requête."""
    if settings.SITE_URL:
        return settings.SITE_URL.rstrip("/")
    return request.build_absolute_uri("/").rstrip("/") if request is not None else ""


def full_name(user):
    return " ".join(filter(None, (user.first_name, user.last_name))) or user.get_username()


def request_reviewers(group):
    """Comptes prévenus d'une demande de compte : gestionnaires actifs du groupe, sinon admins du site."""
    from .members import ADMINS_GROUP, MANAGERS_GROUP

    users = get_user_model().objects.filter(is_active=True).exclude(email="")
    managers = users.filter(groups__name=MANAGERS_GROUP, profile__action_group=group).distinct() if group else users.none()
    if managers.exists():
        return list(managers)
    return list(users.filter(Q(is_superuser=True) | Q(groups__name=ADMINS_GROUP)).distinct())


def notify_registration(user, group, request=None):
    """Nouvelle demande de compte : les gestionnaires du groupe d'action (ou les admins) l'acceptent ou la refusent."""
    name = full_name(user)
    group_name = group.name if group else "aucun groupe"
    url = f"{site_url(request)}/redaction/membres"
    subject = f"Nouvelle demande d'inscription : {name} ({group_name})"
    for reviewer in request_reviewers(group):
        text = (
            f"Bonjour {reviewer.first_name or full_name(reviewer)},\n\n"
            f"{name} ({user.email}) demande à rejoindre le groupe d'action « {group_name} » sur le site.\n\n"
            f"Validez-vous son inscription ? Acceptez ou refusez sa demande sur la page « Membres » :\n{url}\n\n"
            "Ce message est envoyé automatiquement, merci de ne pas y répondre."
        )
        queue_email(reviewer.email, full_name(reviewer), subject, text)


def notify_account_accepted(user, request=None):
    """Demande acceptée : la personne peut maintenant se connecter."""
    url = f"{site_url(request)}/connexion"
    text = (
        f"Bonjour {user.first_name or full_name(user)},\n\n"
        "Bonne nouvelle : votre demande de compte a été acceptée, vous avez maintenant accès au site.\n\n"
        f"Vous pouvez vous connecter avec vos prénom, nom et mot de passe :\n{url}\n\n"
        "Ce message est envoyé automatiquement, merci de ne pas y répondre."
    )
    queue_email(user.email, full_name(user), "Votre compte est validé : vous pouvez vous connecter", text)
