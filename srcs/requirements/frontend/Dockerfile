# ---------- Dépendances ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Développement ----------
# Le code est monté en volume (voir docker-compose.dev.yml) : Vite recharge à chaud.
# VITE_POLL : le volume monté depuis l'hôte ne transmet pas les événements de fichiers, on scrute.
FROM deps AS dev
ENV VITE_POLL=1
EXPOSE 4200
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "4200"]

# ---------- Build ----------
FROM deps AS build
# Limite la mémoire du build pour les petits serveurs (2 Go de RAM) :
#   - NODE_OPTIONS : plafond du tas V8 de Node (Mo)
#   - GOMEMLIMIT / GOMAXPROCS : esbuild est écrit en Go, on le bride aussi
ENV NODE_OPTIONS=--max-old-space-size=768 \
    GOMEMLIMIT=384MiB \
    GOMAXPROCS=2
COPY . .
RUN npm run build

# ---------- Production ----------
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
