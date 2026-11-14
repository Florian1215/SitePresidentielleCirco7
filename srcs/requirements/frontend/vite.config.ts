import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En Docker, le service nginx envoie déjà /api et /admin à Django : ce proxy ne sert que hors Docker
// (npm run dev), avec API_PROXY_TARGET=http://localhost:8000 par exemple.
const backend = process.env.API_PROXY_TARGET ?? 'http://backend:8000';
const proxied = { target: backend, changeOrigin: false, secure: false };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 4200,
    strictPort: true,
    // Derrière le service nginx : le nom d'hôte est celui tapé par le visiteur (localhost, IP de la machine…)
    allowedHosts: true,
    // Volume Docker monté depuis l'hôte : les événements de fichiers n'arrivent pas, on scrute.
    watch: process.env.VITE_POLL ? { usePolling: true, interval: 1000 } : undefined,
    proxy: {
      '/api': proxied,
      '/admin': proxied,
      '/django-static': proxied,
      '/media': proxied,
    },
  },
  build: {
    outDir: 'dist',
    // Avertissement au-delà de 500 ko (même budget que l'ancienne configuration Angular)
    chunkSizeWarningLimit: 500,
  },
});
