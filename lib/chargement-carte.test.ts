import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// US-24 : Leaflet (≈ 42 Ko) n'est chargé que là où une carte s'affiche, jamais côté serveur.
const racine = join(__dirname, "..");
const AVEC_LEAFLET = new Set(["components/CartePosition.tsx", "components/CarteLeaflet.tsx"]);
function fichiers(dossier: string): string[] {
  return readdirSync(join(racine, dossier)).flatMap(nom => {
    const chemin = join(dossier, nom);
    if (statSync(join(racine, chemin)).isDirectory()) return fichiers(chemin);
    return /\.(ts|tsx)$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}
const sources = ["app", "components", "lib"].flatMap(fichiers).map(chemin => ({ chemin: relative(racine, join(racine, chemin)), texte: readFileSync(join(racine, chemin), "utf8") }));

describe("US-24 : chargement de Leaflet", () => {
  it("seuls les composants de carte importent leaflet", () => {
    const importeurs = sources.filter(({ texte }) => /from\s+["']leaflet|import\(\s*["']leaflet|import\s+["']leaflet/.test(texte)).map(({ chemin }) => chemin);
    expect(importeurs.sort()).toEqual([...AVEC_LEAFLET].sort());
  });

  it("les composants de carte ne sont chargés que par next/dynamic avec ssr: false (jamais d'import direct)", () => {
    for (const fichier of AVEC_LEAFLET) {
      const nom = fichier.replace(/^components\//, "").replace(/\.tsx$/, "");
      for (const { chemin, texte } of sources) {
        if (chemin === fichier) continue;
        expect(texte, chemin).not.toMatch(new RegExp(`import\\s+(?!type\\b)[^;]*from\\s+["'][^"']*${nom}["']`));
        if (texte.includes(`import("./${nom}")`)) {
          expect(texte, chemin).toMatch(/^"use client";/);
          expect(texte, chemin).toMatch(new RegExp(`dynamic\\(\\(\\) => import\\("\\./${nom}"\\), \\{ ssr: false`));
        }
      }
    }
  });

  it("l'accueil, le catalogue et l'en-tête n'importent aucun bloc de carte", () => {
    const legers = sources.filter(({ chemin }) => chemin === "app/page.tsx" || chemin === "app/[ville]/page.tsx" || chemin.startsWith("app/catalogue/") || chemin.startsWith("app/[ville]/catalogue/") || chemin === "components/EntetePublic.tsx");
    expect(legers.length).toBeGreaterThan(0);
    for (const { chemin, texte } of legers) expect(texte, chemin).not.toMatch(/leaflet|CartePosition|ChoixPosition|CarteLeaflet/);
  });

  it("US-24.3 : la carte publique n'a aucun moyen d'envoyer la position (ni action serveur, ni fetch, ni mesure, ni stockage)", () => {
    for (const fichier of ["components/CarteBoutiques.tsx", "components/CarteLeaflet.tsx", "app/[ville]/carte/page.tsx"]) {
      const { texte } = sources.find(({ chemin }) => chemin === fichier)!;
      expect(texte, fichier).not.toMatch(/\/actions"|enregistrerMesure|EnregistrerVue|fetch\(|localStorage|sessionStorage|document\.cookie|XMLHttpRequest|sendBeacon/);
    }
    // La position ne passe jamais par l'adresse : seul l'univers y est écrit.
    const carte = sources.find(({ chemin }) => chemin === "components/CarteBoutiques.tsx")!.texte;
    expect(carte.match(/replaceState\([^)]*\)/g)).toEqual(['replaceState(null, "", cle ? `${chemin}?univers=${cle}` : chemin)']);
  });
});
