import { bindings, defineConfig } from "cf/config";

// Vue build as static assets (including public/audio) + the Hono API as one Worker.
// Every request runs the Worker first so the password check (server/index.ts) covers pages and audio too;
// preview URLs are off. APP_PASSWORD comes from .dev.vars locally and `cf deploy --secrets-file` live.
export default defineConfig({
  worker: {
    name: "lafz",
    entrypoint: "./server/index.ts",
    compatibilityDate: "2026-10-01",
    workersDev: true,
    previewUrls: false,
    observability: { enabled: true },
    assets: { notFoundHandling: "single-page-application", runWorkerFirst: true },
    env: {
      DB: bindings.d1({ id: "128bb3e4-b33d-4d36-9c74-8b40e3e067f0", name: "lafz" }),
      ASSETS: bindings.assets(),
      APP_PASSWORD: bindings.secret(),
    },
  },
});
