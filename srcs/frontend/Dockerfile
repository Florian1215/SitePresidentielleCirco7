# ---------- Dépendances ----------
FROM node:24-alpine AS deps
WORKDIR /app
ENV NG_CLI_ANALYTICS=false
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Développement ----------
# Le code est monté en volume (voir docker-compose.dev.yml) : ng serve recharge à chaud.
FROM deps AS dev
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--poll", "1000", "--proxy-config", "proxy.docker.json"]

# ---------- Build ----------
FROM deps AS build
# Limite la mémoire du build pour les petits serveurs (2 Go de RAM) :
#   - NODE_OPTIONS : plafond du tas V8 de Node (Mo)
#   - NG_BUILD_MAX_WORKERS : nombre de workers parallèles d'Angular
#   - GOMEMLIMIT / GOMAXPROCS : esbuild est écrit en Go, on le bride aussi
ENV NODE_OPTIONS=--max-old-space-size=768 \
    NG_BUILD_MAX_WORKERS=1 \
    GOMEMLIMIT=384MiB \
    GOMAXPROCS=2
COPY . .
RUN npx ng build --configuration production

# ---------- Production ----------
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
