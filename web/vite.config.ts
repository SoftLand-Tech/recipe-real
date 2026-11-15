/*
 * Vite config for the RecipeReal web client.
 *
 * The app is served same-origin at `/app` by the Laravel backend (see
 * backend/routes/web.php), so:
 *   - base is '/app/' — every emitted asset URL is prefixed with /app/
 *   - build.outDir writes the bundle INTO the backend's public dir
 *     (../backend/public/app, resolved relative to this workspace). It is
 *     outside the Vite project root, so emptyOutDir must be set explicitly;
 *     it wipes ONLY backend/public/app, never the sibling backend/public/build
 *     (the Laravel landing/Filament Vite assets) next to it.
 *   - dev server proxies /api to a local `php artisan serve` (127.0.0.1:8000)
 *     so the SPA talks to the real backend with cookies-free bearer auth,
 *     exactly like production.
 */
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "../backend/public/app",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
