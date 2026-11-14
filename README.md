# Site de campagne LFI — 7e circonscription des Français·es de l'étranger

Frontend **React 19 + TypeScript + Tailwind CSS 4** (Vite, Node.js) (`srcs/requirements/frontend`) · Backend **Django 5.2 + Django REST Framework** (`srcs/requirements/backend`) · PostgreSQL · nginx.

## Lancer

Au premier lancement, `make` crée `srcs/.env` à partir de `srcs/.env.example` (identifiants admin et mots de passe à changer).

### Développement — `make dev`

`srcs/docker-compose.dev.yml` : le code est monté en volume, tout se recharge à chaud.

Tout le site passe par une seule URL, servie par le service **nginx** (`srcs/requirements/nginx`) :

| Adresse | Destination |
|---|---|
| http://localhost:4200/api/ | API Django REST (`manage.py runserver`, `DEBUG=1`) |
| http://localhost:4200/admin/ | administration Django |
| http://localhost:4200/ (tout le reste) | frontend React (`vite`, rechargement à chaud) |
| localhost:5433 | PostgreSQL (base séparée de la prod) |

Ports modifiables dans `srcs/.env` (`DEV_FRONTEND_PORT`, `DEV_DB_PORT`).

### Production — `make` (ou `make prod`)

`srcs/docker-compose.prod.yml` : nginx devant gunicorn (utilisateur non-root) et le build React,
`DEBUG=0`, redémarrage automatique. Site sur http://localhost:8080 (`HTTP_PORT`) : `/api/` et `/admin/`
vont à Django, `/django-static/` et `/media/` sont servis directement par nginx, le reste va au frontend.
Seul le service nginx est exposé.

Organisation des services : `srcs/requirements/{backend,frontend,nginx}`.

Les deux environnements ont des noms de projet, des bases et des volumes distincts : ils peuvent tourner en même temps.
Chaque Dockerfile a deux cibles (`dev` et `prod`).

### Commandes

| Commande | Effet |
|---|---|
| `make` / `make prod` | lance la prod au premier plan (build inclus) |
| `make dev` | lance le dev au premier plan (build inclus) |
| `make detach` | lance en arrière-plan (prod ; `MODE=dev` pour le dev) |
| `make down`, `make stop`, `make ps`, `make logs`, `make build` | sur la prod par défaut ; ajouter `MODE=dev` pour le dev |
| `make shell`, `make dbshell`, `make migrate`, `make superuser`, `make import-groups` | idem (`MODE=dev` pour le dev) |
| `make exec SERVICE=backend` | ouvre un shell dans un conteneur |
| `make makemigrations` | génère les migrations (toujours sur le dev, écrit dans le code source) |
| `make clean` | arrête et supprime les images locales |
| `make fclean` | ⚠️ arrête **et supprime les bases et images uploadées** de l'environnement visé |
| `make re` / `make vre` | `clean` (ou `fclean`) puis relance |

`SERVICE=<nom>` limite `up`, `logs`, `build`… à un seul service ; `TAIL=<n>` règle le nombre de lignes de `make logs`.

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

## Langues (français, anglais, allemand)

Le site public est disponible en trois langues. Par défaut, il prend la langue du navigateur (sinon le
français) ; le bouton des langues, en haut à droite, permet d'en changer (choix mémorisé dans le navigateur).
On peut aussi forcer la langue par l'URL, par ex. pour partager un lien : `?lang=en` (ou `?lan=en`),
valeurs `fr`, `en`, `de` ; le paramètre est ensuite retiré de l'adresse et le choix mémorisé.

- Textes de l'interface : `srcs/requirements/frontend/src/i18n/fr.ts` (référence), `en.ts`, `de.ts` — mêmes clés,
  vérifiées à la compilation.
- Programme : `src/data/programme.data.ts` (référence), `programme.en.ts`, `programme.de.ts`
  (mêmes mesures, dans le même ordre ; à défaut, le texte français s'affiche).
- Noms de pays, dates et nombres : traduits automatiquement par le navigateur.
- Restent en français : articles, événements Zetkin et noms des groupes (saisis par l'équipe),
  espace rédaction et admin Django.

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

## Carte des bureaux de vote

La page *Voter* (section « Où voter ? ») affiche la même carte avec les bureaux de vote ; un clic sur un
point ouvre la page du consulat si elle est renseignée, sinon le plan OpenStreetMap.

- Les bureaux de vote de l'étranger sont fixés par arrêté quelques mois avant le scrutin (liste publiée sur
  diplomatie.gouv.fr). Tant qu'aucun bureau n'est affiché, la carte indique que les adresses arrivent bientôt.
- **Dans l'admin → Bureaux de vote** : un brouillon masqué existe pour chaque poste consulaire de la
  circonscription (« Bureau de vote de … (à compléter) », position = centre de la ville). Complétez le nom,
  l'adresse, la position exacte et, si besoin, les informations pratiques et le lien, puis cochez
  « affiché sur la carte ». On peut aussi ajouter d'autres bureaux.

## Données collectées

Les formulaires *Je soutiens* / *aide à l'inscription* et *Contact* sont consultables dans l'admin
(*Campagne → Soutiens / Messages de contact*), avec un export CSV.

## À personnaliser

- `srcs/requirements/frontend/src/lib/campaign.ts` : dates de l'élection et date limite d'inscription
  (indicatives, passez `datesConfirmed: true` une fois le décret publié), e-mail de contact, réseaux sociaux.
- `srcs/requirements/frontend/src/data/programme.data.ts` : contenu du programme.
- `srcs/requirements/frontend/src/i18n/fr.ts` (section `legal`) et `srcs/requirements/frontend/src/pages/SmallPages.tsx` : mentions légales (responsable de publication, hébergeur).
# SitePresidentielleCirco7
