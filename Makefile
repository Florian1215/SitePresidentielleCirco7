####################################################### VARIABLE #######################################################
NAME		:=	presidentielle
SRCS_D		:=	srcs
ENV_FILE	:=	$(SRCS_D)/.env
MODE		?=	prod
COMPOSE_F	?=	$(SRCS_D)/docker-compose.$(MODE).yml
SERVICE		?=	#Leave blank
TAIL		?=	100

######################################################## FLAGS #########################################################
FLAGS		=	-f $(COMPOSE_F) --env-file $(ENV_FILE)
COMPOSE		=	docker-compose
DSHELL		=	/bin/sh
MANAGE		=	$(COMPOSE) $(FLAGS) exec backend python manage.py

######################################################## RULES #########################################################
.DEFAULT_GOAL = all

.PHONY: all $(NAME)
all			:	$(NAME)

$(NAME)		:	$(ENV_FILE)
			$(COMPOSE) $(FLAGS) build backend
			$(COMPOSE) $(FLAGS) build frontend
			$(COMPOSE) $(FLAGS) up --build $(SERVICE)

.PHONY: prod
prod		:	all

.PHONY: dev
dev			:	$(ENV_FILE)
			$(MAKE) all MODE=dev

$(ENV_FILE)	:
			cp $(SRCS_D)/.env.example $(ENV_FILE)
			@sed -i.bak "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$$(LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 50)|" $(ENV_FILE) && rm -f $(ENV_FILE).bak
			@echo "$(ENV_FILE) created from .env.example: change the passwords before going to production."

.PHONY: env
env			:	$(ENV_FILE)

CMDS		:=	up build down stop ps ls images top
.PHONY: $(CMDS)
$(CMDS)		:	$(ENV_FILE)
			$(COMPOSE) $(FLAGS) $@ $(SERVICE)

.PHONY: detach
detach		:	$(ENV_FILE)
			$(COMPOSE) $(FLAGS) up --build --$@ $(SERVICE)

.PHONY: logs
logs		:
			$(COMPOSE) $(FLAGS) $@ -f --tail=$(TAIL) $(SERVICE)

# make exec SERVICE=backend
.PHONY: exec
exec		:
			$(COMPOSE) $(FLAGS) $@ $(SERVICE) $(DSHELL)

################################################### DJANGO HELPERS #####################################################
.PHONY: migrate makemigrations superuser shell dbshell import-groups
migrate		:
			$(MANAGE) migrate
# Always on dev: migrations must be written into the source code (mounted volume)
makemigrations:
			$(MAKE) --no-print-directory _makemigrations MODE=dev
.PHONY: _makemigrations
_makemigrations:
			$(MANAGE) makemigrations
superuser	:
			$(MANAGE) createsuperuser
shell		:
			$(MANAGE) shell
dbshell		:
			$(COMPOSE) $(FLAGS) exec db sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

import-groups:
			$(MANAGE) import_action_groups

####################################################### CLEANING #######################################################
.PHONY: clean
clean		:
			$(COMPOSE) $(FLAGS) down --rmi local --remove-orphans

.PHONY: fclean
fclean		:	dusting
			$(COMPOSE) $(FLAGS) down -v --rmi all --remove-orphans

.PHONY: dusting
dusting		:
			find . -path "*/__pycache__/*" -delete
			find . -path "*/__pycache__" -delete

.PHONY: prune
prune		:
			docker system prune -af

.PHONY: re
re			:	clean all

.PHONY: vre
vre			:	fclean all
