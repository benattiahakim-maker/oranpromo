// US-30.1 / US-30.2 : le site et le projet s'appellent BleDeal. « OranPromo » ne reste que là où il est voulu :
// identifiants invisibles gardés (clés du navigateur, modèles WhatsApp oranpromo_*) et conversion des messages de la base.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..");
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap(nom => {
    const chemin = join(dossier, nom);
    return statSync(join(RACINE, chemin)).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

describe("US-30 : BleDeal partout où on le voit", () => {
  it("aucun « OranPromo » dans le code du site (hors tests et conversion des messages de la base)", () => {
    const code = ["app", "components", "lib"].flatMap(fichiers).filter(f => /\.(ts|tsx|css)$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== join("lib", "supabase", "types.ts"));
    const restes = code.filter(f => /OranPromo|ORANPROMO/.test(readFileSync(join(RACINE, f), "utf8")) && f !== join("lib", "textes", "messages.ts"));
    expect(restes).toEqual([]);
  });
  it("identifiants gardés : clés du navigateur et modèles WhatsApp", () => {
    expect(readFileSync(join(RACINE, "lib", "panier.ts"), "utf8")).toContain('"oranpromo:panier"');
    expect(readFileSync(join(RACINE, "components", "MiseAJourCommandes.tsx"), "utf8")).toContain('"oranpromo-son"');
    expect(readFileSync(join(RACINE, "lib", "confirmation.ts"), "utf8")).toContain('"oranpromo_nouvelle_commande_confirmer"');
  });
  it("projet : package.json, README, CLAUDE.md, AGENTS.md, installateur", () => {
    expect(JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")).name).toBe("bledeal");
    for (const f of ["README.md", "CLAUDE.md", "AGENTS.md"]) expect(readFileSync(join(RACINE, f), "utf8")).toMatch(/^(@AGENTS\.md\s+)?#[^\n]*BleDeal|# Règles du projet BleDeal/m);
    expect(readdirSync(RACINE)).toContain("installer-bledeal.bat"); expect(readdirSync(RACINE)).not.toContain("installer-oranpromo.bat");
  });
});
