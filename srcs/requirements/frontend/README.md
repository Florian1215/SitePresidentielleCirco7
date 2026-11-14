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
- `src/pages/` : une page par fichier (+ sa feuille `.scss` pour les pages les plus riches).
- `src/components/` : en-tête, pied de page, cartes, photo, formulaire de soutien, éditeur Quill.
- `src/lib/` : API, connexion, langues (`useI18n`), titres, formulaires, configuration de campagne.
- `src/i18n/` : textes en français (référence), anglais, allemand.
- `src/data/` : programme, pictogrammes, fond de carte, données de l'impôt universel.

## Styles

- `src/index.css` : Tailwind (thème aux couleurs de la charte : `bg-violet`, `text-rouge`, `font-titre`…),
  sans la réinitialisation « preflight » pour garder la typographie du site.
- `src/styles/global.scss` : charte graphique (boutons, cartes, formulaires, grilles…).
- Composants simples : classes utilitaires Tailwind. Pages riches : `.scss` limité à la racine de la page.
- Ordre des couches CSS : thème < global < pages < utilitaires Tailwind.
