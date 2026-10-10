#!/usr/bin/env node
// « npm run test:e2e » : lit les adresses et clés de la pile Supabase LOCALE (`npx supabase status -o env`), refuse tout
// ce qui n'est pas 127.0.0.1 / localhost, puis lance Playwright. Arguments transmis : npm run test:e2e -- e2e/client.spec.ts
import { execSync, spawnSync } from "node:child_process";

const NOMS = ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY", "DB_URL", "MAILPIT_URL", "INBUCKET_URL"];
const env = { ...process.env };
if (!env.API_URL) {
  let sortie;
  try { sortie = execSync("npx --yes supabase@2.120.0 status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch {
    console.error("La pile Supabase locale ne répond pas. Lancez d'abord « npx supabase start » (Docker Desktop ouvert). Voir docs/tests-parcours.md.");
    process.exit(1);
  }
  for (const ligne of sortie.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(ligne.trim());
    if (m && NOMS.includes(m[1])) env[m[1]] = m[2];
  }
}
for (const nom of ["API_URL", "DB_URL"]) {
  if (!/^[a-z]+:\/\/([^@/]*@)?(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(env[nom] ?? "")) {
    console.error(`${nom} n'est pas local (${env[nom] ?? "absent"}) : les tests de parcours ne tournent jamais sur la production.`);
    process.exit(1);
  }
}
// Le site des tests ne doit jamais lire .env.local (clés de production) : ces variables sont imposées par playwright.config.ts.
const r = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(r.status ?? 1);
