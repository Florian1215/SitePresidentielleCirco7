#!/bin/sh
set -e

python manage.py migrate --noinput

# En dev (DEBUG=1), runserver sert lui-même les fichiers statiques.
if [ "$DJANGO_DEBUG" != "1" ]; then
    python manage.py collectstatic --noinput >/dev/null
fi

# Crée le compte administrateur au premier démarrage (ignoré s'il existe déjà).
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    python manage.py createsuperuser --noinput >/dev/null 2>&1 \
        && echo "Superutilisateur « $DJANGO_SUPERUSER_USERNAME » créé." \
        || echo "Superutilisateur « $DJANGO_SUPERUSER_USERNAME » déjà présent."
fi

exec "$@"
