"""Emails transactionnels du site, envoyés par l'API Brevo (https://developers.brevo.com/reference/sendtransacemail).

Réglages (srcs/.env) : BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME. Sans clé, aucun email n'est envoyé
(le site fonctionne normalement, un avertissement est écrit dans les logs).

Les envois passent par la tâche Celery core.tasks.send_email (en dehors de la requête, avec nouvelles tentatives),
déclenchée seulement une fois la transaction enregistrée (transaction.on_commit).

  - demande de compte          → email aux organisateur·ices du groupe d'action choisi (voir request_reviewers),
                                 avec les boutons Accepter / Refuser (page /demande/<lien signé> du site)
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
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


class EmailError(Exception):
    """Envoi refusé ou impossible (Brevo injoignable, clé invalide…)."""


def brevo_configured():
    return bool(settings.BREVO_API_KEY and settings.BREVO_SENDER_EMAIL)


def send_now(to_email, to_name, subject, text, html=None):
    """Envoie un email (HTML et sa version texte) à une personne. Lève EmailError en cas d'échec."""
    if not html:
        html = "<html><body>" + "".join(f"<p>{escape(p).replace(chr(10), '<br>')}</p>" for p in text.split("\n\n")) + "</body></html>"
    payload = {
        "sender": {"email": settings.BREVO_SENDER_EMAIL, "name": settings.BREVO_SENDER_NAME or settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, **({"name": to_name} if to_name else {})}],
        "subject": subject,
        "textContent": text,
        "htmlContent": html,
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


def queue_email(to_email, to_name, subject, text, html=None):
    """Envoi en tâche de fond, après l'enregistrement de la transaction en cours."""
    if not to_email:
        return
    if not brevo_configured():
        logger.warning("Email « %s » non envoyé à %s : BREVO_API_KEY / BREVO_SENDER_EMAIL absents.", subject, to_email)
        return
    from .tasks import send_email

    transaction.on_commit(lambda: send_email.delay(to_email, to_name, subject, text, html))


def site_url(request=None):
    """Adresse publique du site : DJANGO_SITE_URL, sinon celle de la requête."""
    if settings.SITE_URL:
        return settings.SITE_URL.rstrip("/")
    return request.build_absolute_uri("/").rstrip("/") if request is not None else ""


def full_name(user):
    return " ".join(filter(None, (user.first_name, user.last_name))) or user.get_username()


def request_reviewers(group):
    """Comptes prévenus d'une demande de compte : seulement les personnes du groupe d'action demandé qui peuvent
    l'accepter, c'est-à-dire ses gestionnaires, et les admins / super-utilisateur·ices dont c'est le groupe (profil).
    Les autres admins ne reçoivent rien (ils voient les demandes sur la page « Membres »). Aucun : aucun email.
    Un seul email par adresse, même si plusieurs comptes la partagent (ex. super-utilisateur + compte gestionnaire)."""
    from .members import ADMINS_GROUP, MANAGERS_GROUP

    if group is None:
        return []
    managers = (
        get_user_model().objects.filter(is_active=True, profile__action_group=group).exclude(email="")
        .filter(Q(groups__name=MANAGERS_GROUP) | Q(groups__name=ADMINS_GROUP) | Q(is_superuser=True))
        .distinct().order_by("pk")
    )
    if not managers:
        logger.warning("Demande de compte pour « %s » : aucun·e organisateur·ice avec un email à prévenir.", group)
    by_email = {}
    for reviewer in managers:
        by_email.setdefault(reviewer.email.lower(), reviewer)
    return list(by_email.values())


def render_html(template, request=None, **context):
    site = site_url(request)
    return render_to_string(f"emails/{template}.html", {
        "site": site, "site_label": site.split("://", 1)[-1], **context,
    })


def notify_registration(user, group, request=None):
    """Nouvelle demande de compte : chaque gestionnaire du groupe d'action (ou admin) reçoit les informations de la
    personne et deux boutons, Accepter / Refuser, avec un lien signé qui lui est propre (voir members.request_token)."""
    from .members import request_token

    site = site_url(request)
    group_name = group.name if group else "Aucun groupe d'action"
    subject = "Nouvelle demande d'inscription"
    for reviewer in request_reviewers(group):
        url = f"{site}/demande/{request_token(user, reviewer)}"
        accept_url, refuse_url = f"{url}?action=accepter", f"{url}?action=refuser"
        text = (
            f"{subject}\n\n{full_name(user)}\n{user.email}\n{group_name}\n\n"
            f"Accepter : {accept_url}\nRefuser : {refuse_url}"
        )
        html = render_html("registration", request, subject=subject, member=user, group_name=group_name,
                           accept_url=accept_url, refuse_url=refuse_url,
                           preheader=f"{full_name(user)} · {group_name}")
        queue_email(reviewer.email, full_name(reviewer), subject, text, html)


def notify_account_accepted(user, request=None):
    """Demande acceptée : la personne peut maintenant se connecter."""
    url = f"{site_url(request)}/connexion"
    subject = "Votre compte est validé"
    text = f"Bienvenue {user.first_name} !\n\nVotre compte est validé.\n\nSe connecter : {url}"
    html = render_html("accepted", request, subject=subject, member=user, login_url=url,
                       preheader="Vous pouvez maintenant vous connecter.")
    queue_email(user.email, full_name(user), subject, text, html)
