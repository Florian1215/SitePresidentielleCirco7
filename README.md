# Site de campagne LFI — 7e circonscription des Français·es de l'étranger

Frontend **Angular 22** (`srcs/frontend`) · Backend **Django 5.2 + Django REST Framework** (`srcs/backend`) · PostgreSQL · nginx.

## Lancer

Au premier lancement, `make` crée `srcs/.env` à partir de `srcs/.env.example` (identifiants admin et mots de passe à changer).

### Développement — `make dev` (ou simplement `make`)

`srcs/docker-compose.dev.yml` : le code est monté en volume, tout se recharge à chaud.

| Service | URL | Détail |
|---|---|---|
| Frontend | http://localhost:4200 | `ng serve` ; proxifie `/api`, `/admin`, `/media` vers Django |
| Admin Django | http://localhost:4200/admin/ | |
| Backend | http://localhost:8001 | `manage.py runserver`, `DEBUG=1` |
| PostgreSQL | localhost:5433 | base séparée de la prod |

Ports modifiables dans `srcs/.env` (`DEV_FRONTEND_PORT`, `DEV_BACKEND_PORT`, `DEV_DB_PORT`).

### Production — `make prod`

`srcs/docker-compose.prod.yml` : gunicorn (utilisateur non-root) + build Angular optimisé servi par nginx,
`DEBUG=0`, redémarrage automatique. Site sur http://localhost:8080 (`HTTP_PORT`).

Les deux environnements ont des noms de projet, des bases et des volumes distincts : ils peuvent tourner en même temps.
Chaque Dockerfile a deux cibles (`dev` et `prod`).

### Commandes

| Commande | Effet |
|---|---|
| `make dev` / `make prod` | lance l'environnement (build inclus) |
| `make dev-down` / `make prod-down` / `make down` | arrête dev / prod / les deux |
| `make logs`, `make ps`, `make shell`, `make dbshell`, `make migrate`, `make superuser`, `make import-groups` | sur le dev ; ajouter `MODE=prod` pour la prod |
| `make makemigrations` | génère les migrations (dev, écrit dans le code source) |
| `make clean` | arrête tout |
| `make fclean` | ⚠️ arrête tout **et supprime les bases et images uploadées** (dev et prod) |
| `make re` | `clean` puis `dev` |

## Gérer les droits des rédacteur·ices

Dans l'admin → *Utilisateurs* : créez le compte puis ajoutez-le à un groupe (créés automatiquement) :

| Groupe | Droits |
|---|---|
| **Rédacteur·ices** | écrire, modifier et supprimer **ses** articles, en brouillon uniquement |
| **Éditeur·ices** | + publier, modifier/supprimer les articles des autres, gérer les catégories |

Vous pouvez aussi attribuer les permissions une par une (`blog | article | …`) ou créer vos propres groupes :

- `blog.add_article` — écrire un article
- `blog.change_article` / `blog.delete_article` — modifier / supprimer ses articles
- `blog.publish_article` — publier
- `blog.manage_all_articles` — modifier / supprimer les articles des autres

Pour qu'un compte accède aussi à l'admin Django, cochez « Statut équipe ».

## Écrire un article

Les articles s'écrivent avec un éditeur visuel (Quill), le même dans l'admin Django et dans l'espace
rédaction du site (*Écrire un article*) : intertitres, gras, italique, souligné, barré, alignement, listes,
retraits, citations, liens, images (bouton ou glisser-déposer) et vidéos YouTube, Vimeo ou PeerTube.

- Les images sont envoyées sur le serveur et réduites à 1 800 px ; elles apparaissent dans l'admin →
  *Images d'articles* (utile pour supprimer celles qui ne servent plus).
- Le HTML est nettoyé à chaque enregistrement (`blog/sanitize.py`) : seules les balises de mise en forme
  sont conservées.
- L'image de couverture s'affiche en grand bandeau en haut de l'article.

## Liens du pied de page

Dans l'admin → *Gestion du site* :

- **Sites amis** : colonne « Sites amis » du pied de page (nom, adresse, ordre, affiché ou non).
- **Réseaux sociaux** : bandeau « Suivez les insoumis·es de la 7e circo » et bloc « Suivez-nous » de la page Contact.
  Choisissez le réseau pour obtenir le bon pictogramme (« Autre » affiche une icône de lien).
  Le bandeau n'apparaît que s'il y a au moins un réseau affiché.

## Carte des groupes d'action

La page *La circonscription* affiche une carte des 16 pays avec les groupes d'action insoumis ;
un clic sur un point ouvre le groupe sur Action populaire.

- **Mettre à jour depuis Action populaire** : `make import-groups` (ajoute les nouveaux groupes, met à jour
  noms et positions ; ne supprime rien et ne réaffiche pas un groupe masqué).
- **Dans l'admin → Groupes d'action** : masquer un groupe (case « affiché sur la carte »), corriger son nom
  ou sa position, ou ajouter un groupe à la main (nom, pays, lien, latitude/longitude).
- Le fond de carte (`europe-map.ts`) est généré à partir de Natural Earth (domaine public).

## Données collectées

Les formulaires *Je soutiens* / *aide à l'inscription* et *Contact* sont consultables dans l'admin
(*Campagne → Soutiens / Messages de contact*), avec un export CSV.

## À personnaliser

- `srcs/frontend/src/app/core/campaign.config.ts` : dates de l'élection et date limite d'inscription
  (indicatives, passez `datesConfirmed: true` une fois le décret publié), e-mail de contact, réseaux sociaux.
- `srcs/frontend/src/app/data/programme.data.ts` : contenu du programme.
- `srcs/frontend/src/app/pages/legal/legal.ts` : mentions légales (responsable de publication, hébergeur).
# SitePresidentielleCirco7
