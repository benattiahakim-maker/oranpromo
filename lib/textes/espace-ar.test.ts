// US-35 : textes de l'espace commerçant en arabe (liste à valider : docs/textes-espace-ar.md).
import { describe, expect, it } from "vitest";
import { fr } from "./fr";
import { ar } from "./ar";
import { traduireMessage } from "./messages";
import { texteAbonnes, texteBonsInscription } from "@/lib/abonnements";
import { texteResumeEspace } from "@/lib/avis";
import { releveDuMois } from "@/lib/bons";
import { estStockInsuffisant } from "@/lib/commandes";
import { textePrecision } from "@/lib/position";
import { libelleStock } from "@/lib/stock";
import { dateLongue, heureOran } from "@/lib/tableau-commandes";

type Arbre = { [cle: string]: string | Arbre };
const feuilles = (arbre: Arbre, prefixe = ""): [string, string][] =>
  Object.entries(arbre).flatMap(([cle, valeur]) => typeof valeur === "string" ? [[`${prefixe}${cle}`, valeur] as [string, string]] : feuilles(valeur, `${prefixe}${cle}.`));
const variables = (texte: string) => [...texte.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
const ARABE = /[\u0600-\u06FF]/;

describe("US-35 : textes de l'espace", () => {
  const textesFr = new Map(feuilles(fr.espace as unknown as Arbre)), textesAr = new Map(feuilles(ar.espace as unknown as Arbre));
  it("mêmes clés en français et en arabe, aucun texte vide", () => {
    expect([...textesAr.keys()].sort()).toEqual([...textesFr.keys()].sort());
    for (const [cle, texte] of textesAr) expect(texte.trim(), cle).not.toBe("");
  });
  it("mêmes variables {…} des deux côtés (rien ne se perd à la traduction)", () => {
    for (const [cle, texte] of textesFr) expect(variables(textesAr.get(cle)!), cle).toEqual(variables(texte));
  });
  it("chaque texte arabe contient de l'arabe (sauf les marques et symboles gardés tels quels)", () => {
    const gardes = new Set(["carte.whatsapp", "retrait.bonBleDeal", "bons.resume"]); // « WhatsApp », « {bon} BleDeal » : noms gardés ; « {bons} · {montant} » : que des valeurs
    for (const [cle, texte] of textesAr) if (!gardes.has(cle) && /[A-Za-zÀ-ÿ]{3}/.test(textesFr.get(cle)!)) expect(texte, cle).toMatch(ARABE);
  });
  it("le commerçant n'est pas tutoyé en français (« vous »)", () => {
    for (const [cle, texte] of textesFr) expect(texte, cle).not.toMatch(/(^|[^\p{L}])(tu|ton|ta|tes|toi)(?=[^\p{L}]|$)/iu);
  });
  it("les messages serveur de l'espace sont traduits (et le français reste tel quel)", () => {
    for (const message of ["Commande mise à jour.", "C’est noté : le client est averti.", "Position enregistrée.", "Tapez les 6 chiffres du code.", "Impossible de publier l’article. Réessayez.",
      "Impossible de lire cette commande. Réessayez.", "Votre compte n’est rattaché à aucune boutique.", "Impossible de charger les commandes. Réessayez.",
      "Vous pouvez ajouter au maximum 5 photos.", "Choisissez des photos JPEG, PNG ou WebP non vides.", "Impossible d’enregistrer votre accord. Réessayez.",
      "Les conditions ont changé : rechargez la page.", "Ce QR code n’est pas valide pour votre boutique."]) {
      expect(traduireMessage(message, "ar"), message).toMatch(ARABE);
      expect(traduireMessage(message, "fr")).toBe(message);
    }
  });
  it("refus « stock insuffisant » traduit avec ses valeurs, et toujours reconnu", () => {
    const message = "Stock insuffisant pour « Robe fleurie » en taille M : il reste 1 pièce(s), la commande en demande 2. Corrigez le stock dans Mes articles ou annulez la commande avec le motif « Plus en stock ».";
    const arabe = traduireMessage(message, "ar");
    expect(arabe).toMatch(ARABE); expect(arabe).toContain("Robe fleurie");
    expect(estStockInsuffisant(message)).toBe(true); expect(estStockInsuffisant(arabe)).toBe(true);
  });
});

describe("US-35 : fonctions de l'espace en arabe (le français ne change pas)", () => {
  const abonnes = { total: 12, sept_jours: 3, inscrits: 2, bons_inscription_mois: 3, plafond_inscriptions_mois: 20, montant_bon_inscription: 500, part_boutique: 250 };
  it("abonnés", () => {
    expect(texteAbonnes(abonnes)).toBe("12 clients suivent votre boutique · +3 cette semaine · dont 2 inscrits en boutique");
    expect(texteAbonnes(abonnes, "ar")).toBe("12 زبائن يتبّعو الحانوت نتاعك · +3 هاد السيمانة · منهم 2 تسجّلو في الحانوت");
    expect(texteBonsInscription(abonnes, "ar")).toMatch(ARABE);
    expect(texteBonsInscription(abonnes, "ar")).toContain("3 / 20");
  });
  it("résumé des avis", () => {
    const resume = { nombre: 18, moyenne: 4.6, sansReponse: 2 };
    expect(texteResumeEspace(resume)).toBe("★ 4,6 · 18 avis · 2 sans réponse");
    expect(texteResumeEspace(resume, "ar")).toBe(`★ 4,6 · ${ar.espace.resumeAvis.nombre.replace("{n}", "18")} · ${ar.espace.resumeAvis.sansReponse.replace("{n}", "2")}`);
  });
  it("relevé du mois, stock, précision, heure", () => {
    expect(releveDuMois("2026-10-01")).toBe("relevé d’octobre");
    expect(releveDuMois("2026-10-01", "ar", ar.espace.retrait)).toMatch(/^كشف /);
    expect(libelleStock(0)).toBe("Épuisé"); expect(libelleStock(0, ar.espace.articles)).toBe("ما بقاش"); expect(libelleStock(3, ar.espace.articles)).toBe("3 حبات");
    expect(textePrecision(150).avertissement).toContain("Position peu précise (± 150 m)");
    expect(textePrecision(150, ar.espace.position).texte).toMatch(ARABE);
    const ms = Date.parse("2026-10-09T13:05:00Z");
    expect(heureOran(ms)).toBe("14 h 05");
    expect(dateLongue(ms, "fr")).toBe("vendredi 09/10 à 14 h 05");
    expect(dateLongue(ms, "ar", ar.espace.preparation.dateLongue)).toMatch(ARABE);
  });
});
