// Tests de parcours (e2e) : adresses de la pile Supabase LOCALE. Jamais la production : tout ce qui n'est pas
// 127.0.0.1 ou localhost est refusé avant le moindre appel (docs/tests-parcours.md).
// Les valeurs viennent de `npx supabase status -o env` (lues par e2e/lancer.mjs) ; aucune clé n'est écrite ici.

function lire(nom: string, ...autres: string[]): string {
  for (const n of [nom, ...autres]) { const v = process.env[n]?.trim(); if (v) return v; }
  throw new Error(`Variable ${nom} absente : lancez les tests avec « npm run test:e2e » (voir docs/tests-parcours.md).`);
}

export function verifierLocal(adresse: string, quoi: string): string {
  let hote: string;
  try { hote = new URL(adresse).hostname; } catch { throw new Error(`${quoi} : adresse invalide.`); }
  if (hote !== "127.0.0.1" && hote !== "localhost") {
    throw new Error(`${quoi} (${hote}) n'est pas local : les tests de parcours ne tournent que sur la pile Supabase locale, jamais sur la production.`);
  }
  return adresse.replace(/\/$/, "");
}

export const E2E = {
  get supabaseUrl() { return verifierLocal(lire("API_URL"), "API_URL"); },
  get cleAnon() { return lire("ANON_KEY"); },
  get cleService() { return lire("SERVICE_ROLE_KEY"); },
  get baseDeDonnees() { return verifierLocal(lire("DB_URL"), "DB_URL"); },
  get mailpit() { return verifierLocal(lire("MAILPIT_URL", "INBUCKET_URL"), "MAILPIT_URL"); },
  site: "http://127.0.0.1:3100",
};
