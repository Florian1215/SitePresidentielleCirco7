# Frontend — React + TypeScript + Tailwind CSS

Site public et espace rédaction, construits avec [Vite](https://vite.dev) (Node.js), React 19,
React Router 7, TypeScript et Tailwind CSS 4. L'API est fournie par le backend Django (`../backend`).
En Docker, le service nginx (`../nginx`) sert tout le site sur une seule URL : `/api` et `/admin` vont à Django, le reste au frontend.

## Commandes

```bash
npm install
npm run dev        # serveur de développement sur http://localhost:4200 (proxy /api, /admin, /media → Django)
npm run build      # vérification TypeScript + build de production dans dist/
npm run preview    # aperçu du build
npm run typecheck  # vérification TypeScript seule
```

Hors Docker, indiquez l'adresse du backend : `API_PROXY_TARGET=http://localhost:8000 npm run dev`.

## Organisation

- `src/main.tsx`, `src/App.tsx` : démarrage, routes (pages chargées à la demande).
- `src/pages/` : une page par fichier.
- `src/components/` : en-tête, pied de page, cartes, photo, formulaire de soutien, éditeur Quill.
- `src/lib/` : API, connexion, langues (`useI18n`), titres, formulaires, configuration de campagne.
- `src/i18n/` : textes en français (référence), anglais, allemand.
- `src/data/` : programme, pictogrammes, fond de carte, données de l'impôt universel.

## Styles

Tout le style s'écrit en **Tailwind CSS 4**, en classes utilitaires dans le JSX (pas de SCSS).

- `src/index.css`, la feuille principale :
  - thème aux couleurs de la charte : `bg-violet`, `text-rouge`, `font-titre`, `rounded-site`, `shadow-site`,
    `px-gutter`, `ease-bounce`, animations `animate-station-hop` et `animate-iu-in` ;
  - styles de base des éléments HTML (titres, liens, champs) ;
  - briques de la charte réutilisées partout, dans la couche `components` : `site-container`, `section`,
    `section-violet`, `btn` (+ `btn-rouge`, `btn-outline`, `btn-sm`…), `card`, `field`, `alert`, `badge`,
    `cat-*` (couleurs des parties du programme)… et `prose` pour le contenu des articles.
- Sans la réinitialisation « preflight » : la base définit elle-même la typographie du site. Conséquence : une
  bordure sur un seul côté se style avec `[border-top-style:dashed]` plutôt que `border-dashed` (qui toucherait
  les quatre côtés).
- Ordre des couches CSS : thème < base < components < utilitaires. Une classe utilitaire ajoutée dans le JSX
  l'emporte donc toujours sur les briques de la charte (`btn w-full`, `section pb-0`…).
- Classes longues ou dépendant d'un état : constantes en haut du fichier (`POSTER_STYLES`, `BALLOT`, `LVL`…),
  toujours écrites en entier pour que Tailwind les détecte (jamais de `` `left-[${x}]` ``).
- `src/components/RichEditor.css` : surcharges de la feuille de Quill (éditeur d'articles), chargées avec l'éditeur.
