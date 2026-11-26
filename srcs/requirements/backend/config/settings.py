import os
from pathlib import Path

from celery.schedules import crontab

BASE_DIR = Path(__file__).resolve().parent.parent


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,backend")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:8080")
#: Adresse publique du site (ex. https://exemple.fr), pour les liens absolus des aperçus d'articles sur les réseaux.
SITE_URL = os.environ.get("DJANGO_SITE_URL", "")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "core",
    "blog",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "presidentielle"),
        "USER": os.environ.get("POSTGRES_USER", "presidentielle"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

AUTHENTICATION_BACKENDS = [
    "core.backends.EmailBackend",  # connexion par email + mot de passe (site et /admin)
    "core.backends.SiteAdminBackend",  # admins du site : tous les droits du site (accès à /admin : core/admin.py)
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
# Langues du site : le front envoie la langue choisie (en-tête Accept-Language), Django traduit alors
# ses messages standard (validation de formulaires…). Les textes propres au site restent en français.
LANGUAGES = [("fr", "Français"), ("en", "English"), ("de", "Deutsch")]
TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

# Servis par nginx sous /django-static/ et /media/
STATIC_URL = "/django-static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Derrière le reverse proxy nginx
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Liens « nouveau mot de passe » créés par les admins (page Membres) : valables 3 jours, une seule fois.
PASSWORD_RESET_TIMEOUT = 3 * 24 * 3600

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 9,
    "NUM_PROXIES": 1,
    "DEFAULT_THROTTLE_RATES": {
        "public_forms": "10/hour",
        "login": "10/min",
        "member_request": "60/min",  # boutons Accepter / Refuser des emails de demande de compte (liens signés)
        "track": "30/min",  # comptage des visites (page « Trackers »)
        "user": "120/hour",  # envoi d'images depuis l'éditeur
    },
}

# Utile seulement si le frontend est servi par `ng serve` (port 4200) en développement.
CORS_ALLOWED_ORIGINS = env_list("DJANGO_CORS_ALLOWED_ORIGINS", "http://localhost:4200")

DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024


# Agenda : calendrier public Zetkin de la campagne (page Agenda et accueil), copié en base toutes les heures (core/tasks.py)
ZETKIN_ICS_URL = os.environ.get("ZETKIN_ICS_URL", "https://app.zetkin.org/o/1030/events.ics")
# API publique Zetkin des événements : elle donne le projet de chaque événement (absent du flux .ics)
ZETKIN_ACTIONS_URL = os.environ.get("ZETKIN_ACTIONS_URL", "https://app.zetkin.org/api/orgs/1030/actions")
# Projets Zetkin affichés sur le site (ids) : les événements des autres projets (internes) sont masqués.
#   4920 « Réunions publiques », 11672 « Diffusion de tracts/Porte-à-Porte »
ZETKIN_PUBLIC_PROJECTS = {int(p) for p in env_list("ZETKIN_PUBLIC_PROJECTS", "4920,11672")}

# Cache : en mémoire (par processus) par défaut ; « shared » (fichiers) est commun aux processus gunicorn,
# pour l'état de l'import des groupes d'action lancé depuis l'admin.
CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    "shared": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": os.environ.get("DJANGO_SHARED_CACHE_DIR", "/tmp/django-shared-cache"),
    },
}

# Emails transactionnels (demandes de compte, compte validé) envoyés par l'API Brevo, voir core/emails.py.
# Sans clé ni adresse d'expédition, aucun email n'est envoyé.
BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL", "")
BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME", "")

# Celery : tâches de fond, avec Redis comme broker (service « celery » des docker-compose, voir config/celery.py)
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://redis:6379/0")
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_IGNORE_RESULT = True
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BEAT_SCHEDULE = {
    # Agenda Zetkin → table ZetkinEvent, à chaque heure pile
    "sync-zetkin-events": {
        "task": "core.tasks.sync_zetkin_events",
        "schedule": crontab(minute=0),
    },
    # Nombre de soutiens (Action populaire) → table SupportersCount, à chaque heure pile
    "sync-supporters-count": {
        "task": "core.tasks.sync_supporters_count",
        "schedule": crontab(minute=0),
    },
}
