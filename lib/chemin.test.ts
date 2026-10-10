import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { cheminSuite } from "./chemin";
import { cheminSuite as cheminSuiteConnexion } from "./connexion";

// Suivi de la relecture n°6, point 4 : cheminSuite dans un module sans dépendance, pour ne pas embarquer le client
// Supabase dans les composants du navigateur qui utilisent lib/ville.ts.

/** Fichiers importés (chemins relatifs et « @/ ») à partir d'un fichier, de proche en proche. */
function importsDe(fichier: string, vus = new Set<string>()): Set<string> {
  if (vus.has(fichier)) return vus;
  vus.add(fichier);
  const source = readFileSync(fichier, "utf8");
  for (const [, cible] of source.matchAll(/^(?:import|export)\s[^;]*?from\s+"([^"]+)"/gm)) {
    if (cible.startsWith("./") || cible.startsWith("../") || cible.startsWith("@/")) {
      const base = cible.startsWith("@/") ? join(process.cwd(), cible.slice(2)) : join(dirname(fichier), cible);
      const trouve = [".ts", ".tsx", "/index.ts"].map(ext => base + ext).find(f => { try { readFileSync(f); return true; } catch { return false; } });
      if (trouve) importsDe(trouve, vus);
    } else vus.add(`paquet:${cible}`);
  }
  return vus;
}

describe("relecture n°6 suivi, point 4 : lib/chemin.ts", () => {
  it("aucun import : ni Supabase, ni Next.js", () => {
    expect(readFileSync(join(process.cwd(), "lib/chemin.ts"), "utf8")).not.toMatch(/^\s*(import|export .* from)/m);
  });
  it("lib/ville.ts n’embarque plus lib/connexion.ts ni le client Supabase", () => {
    const graphe = [...importsDe(join(process.cwd(), "lib/ville.ts"))];
    expect(graphe.some(f => f.endsWith("lib/chemin.ts"))).toBe(true);
    expect(graphe.some(f => f.endsWith("lib/connexion.ts"))).toBe(false);
    expect(graphe.filter(f => /supabase/.test(f))).toEqual([]);
  });
  it("lib/connexion.ts réexporte la même fonction (connexion et lien magique inchangés)", () => {
    expect(cheminSuiteConnexion).toBe(cheminSuite);
    expect(cheminSuite("/compte/commandes?x=1#a")).toBe("/compte/commandes?x=1#a");
    expect(cheminSuite("//evil.example")).toBeNull();
    expect(cheminSuite("/%2F%2Fevil.example")).toBeNull();
    expect(cheminSuite(null)).toBe("/espace");
  });
});
