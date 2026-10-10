import { defineConfig } from "@playwright/test";

// Tests de parcours (e2e/) : vrai navigateur, écran de téléphone 375 px, site construit et lancé sur
// http://127.0.0.1:3100 contre la pile Supabase LOCALE (`npx supabase start`), jamais la production.
// Lancer avec « npm run test:e2e » (e2e/lancer.mjs lit les adresses et clés locales). Voir docs/tests-parcours.md.
const env = process.env;
// E2E_PORT : port du site des tests (3100 par défaut) ; un autre port permet à deux dossiers de lancer leurs tests en même temps.
const port = /^\d{4,5}$/.test(env.E2E_PORT ?? "") ? env.E2E_PORT! : "3100";
const site = `http://127.0.0.1:${port}`;
const supabase = env.API_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(supabase)) {
  throw new Error("API_URL doit être la pile Supabase locale (http://127.0.0.1:54321) : lancez « npm run test:e2e ».");
}

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  // Un seul site et une seule base : les fichiers passent l'un après l'autre (chaque test crée ses propres données).
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(env.CI),
  retries: env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: site,
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "fr-FR",
    timezoneId: "Africa/Algiers",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "telephone-375", use: { browserName: "chromium" } }],
  webServer: {
    // Recommandation du guide Next.js (testing/playwright.md) : tester le site construit (next build + next start).
    // BLEDEAL_E2E=1 : construction à part dans .next-e2e (next.config.ts).
    command: `npx next build && npx next start -p ${port} -H 127.0.0.1`,
    url: `${site}/villes`,
    // Jamais de serveur déjà lancé par défaut : Playwright jouait sinon les parcours en silence contre le site qui
    // occupait le port, construit depuis un AUTRE commit (ou un autre dossier) : les écrans récents manquaient et le
    // test s'arrêtait sur « Test timeout » (cause de l'échec ponctuel de e2e/avis.spec.ts, « Mots interdits »). Port
    // occupé : erreur immédiate. Réutilisation seulement demandée exprès : E2E_REUTILISER=1 (site construit de ce commit).
    reuseExistingServer: env.E2E_REUTILISER === "1",
    timeout: 600_000,
    env: {
      BLEDEAL_E2E: "1",
      NEXT_PUBLIC_SUPABASE_URL: supabase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY ?? "",
      NEXT_PUBLIC_SITE_URL: site,
      CONNEXION_CLIENT: "email",
      // Rien ne part vers WhatsApp, Claude, Turnstile ou CARTO : ces variables restent vides. Une variable déjà posée,
      // même vide, n'est pas remplacée par .env.local : les clés de production d'un .env.local ne servent jamais ici.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      VISITEURS_SECRET: "",
      CODES_TELEPHONE_SECRET: "",
      WHATSAPP_PHONE_NUMBER_ID: "",
      ANTHROPIC_API_KEY: "",
      WHATSAPP_TOKEN: "",
      CRON_SECRET: "",
      CONFIRMATION_SECRET: "",
      NEXT_PUBLIC_CARTO_CLE: "",
    },
  },
});
