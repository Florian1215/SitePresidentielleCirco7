DEV  = docker compose -f srcs/docker-compose.dev.yml --env-file srcs/.env
PROD = docker-compose -f srcs/docker-compose.prod.yml --env-file srcs/.env
ENV  = srcs/.env

# Les commandes utilitaires (migrate, shell, logs…) ciblent le dev par défaut :
#   make shell            -> environnement de dev
#   make shell MODE=prod  -> environnement de prod
MODE    ?= dev
COMPOSE  = $(if $(filter prod,$(MODE)),$(PROD),$(DEV))

.PHONY: all dev prod down dev-down prod-down stop logs ps migrate makemigrations \
        superuser shell dbshell import-groups clean fclean re

all: dev

$(ENV):
	@cp srcs/.env.example $(ENV)
	@sed -i.bak "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$$(LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 50)|" $(ENV) && rm -f $(ENV).bak
	@echo ">> $(ENV) créé à partir de .env.example (pensez à changer les mots de passe)"

# ---------- Développement (rechargement à chaud) ----------
dev: $(ENV)
	$(DEV) up -d --build --renew-anon-volumes
	@echo ">> Frontend (ng serve) : http://localhost:$$(grep ^DEV_FRONTEND_PORT $(ENV) | cut -d= -f2)  (admin : /admin/)"
	@echo ">> Backend (runserver) : http://localhost:$$(grep ^DEV_BACKEND_PORT $(ENV) | cut -d= -f2)"

dev-down:
	$(DEV) down

# ---------- Production ----------
# Builds lancés l'un après l'autre (et non en parallèle) pour ne pas saturer la RAM
# des petits serveurs : le build Angular est le plus gourmand.
prod: $(ENV)
	$(PROD) build backend
	$(PROD) build frontend
	$(PROD) up -d
	@echo ">> Site  : http://localhost:$$(grep ^HTTP_PORT $(ENV) | cut -d= -f2)"
	@echo ">> Admin : http://localhost:$$(grep ^HTTP_PORT $(ENV) | cut -d= -f2)/admin/"

prod-down:
	$(PROD) down

# ---------- Utilitaires ----------
down: dev-down prod-down

stop:
	$(COMPOSE) stop

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

migrate:
	$(COMPOSE) exec backend python manage.py migrate

makemigrations:
	$(DEV) exec backend python manage.py makemigrations

superuser:
	$(COMPOSE) exec backend python manage.py createsuperuser

shell:
	$(COMPOSE) exec backend python manage.py shell

# Met à jour les groupes d'action de la carte depuis Action populaire
import-groups:
	$(COMPOSE) exec backend python manage.py import_action_groups

dbshell:
	$(COMPOSE) exec db sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

clean:
	$(DEV) down --remove-orphans
	$(PROD) down --remove-orphans

# Attention : supprime aussi les bases de données et les images uploadées (dev ET prod).
fclean:
	$(DEV) down --volumes --rmi local --remove-orphans
	$(PROD) down --volumes --rmi local --remove-orphans

re: clean all
