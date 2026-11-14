# Point d'entrée unique du site : une seule URL pour tout.
#   /api/, /admin/        → Django (backend)
#   /django-static/, /media/ → fichiers de l'admin Django et images envoyées
#   tout le reste         → frontend React
FROM nginx:1.27-alpine AS base
RUN rm /etc/nginx/conf.d/default.conf
COPY conf/common.conf /etc/nginx/snippets/common.conf
EXPOSE 80

# ---------- Développement : Vite (rechargement à chaud) et runserver ----------
FROM base AS dev
COPY conf/dev.conf /etc/nginx/conf.d/site.conf

# ---------- Production : gunicorn, build React, fichiers statiques servis par nginx ----------
FROM base AS prod
COPY conf/prod.conf /etc/nginx/conf.d/site.conf
