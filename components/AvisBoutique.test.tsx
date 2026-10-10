import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AvisBoutique from "./AvisBoutique";
import NoteBoutique, { texteNote } from "./NoteBoutique";
import { textesDe } from "@/lib/textes";

const fr = textesDe("fr").avis, ar = textesDe("ar").avis;
const resume = (moyenne: number | null, nombre: number, criteres = { accueil: 12, article_conforme: 9, rapidite: 0 }) => ({ moyenne, nombre, criteres });
const avis = [
  { id: "a1", auteur: "Amine B.", note: 5, criteres: ["accueil" as const], commentaire: "Très bon accueil, la robe est comme sur la photo.", mois: "2026-10-01", reponse: "Merci Amine, à bientôt !" },
  { id: "a2", auteur: "Sara K.", note: 3, criteres: [], commentaire: null, mois: "2026-09-01", reponse: null },
];

describe("US-32.3 : note de la boutique (textes n° 9 et 10)", () => {
  it("à partir de 3 avis : « ★ 4,6 · 18 avis » ; fiche : « ★ 4,6 (18 avis) »", () => {
    expect(texteNote({ resume: resume(4.6, 18), t: fr })).toBe("★ 4,6 · 18 avis");
    expect(texteNote({ resume: resume(4.6, 18), t: fr, forme: "fiche" })).toBe("★ 4,6 (18 avis)");
    expect(texteNote({ resume: resume(4.6, 18), t: ar })).toBe("★ 4,6 · 18 راي");
  });
  it("sous le seuil : « Pas encore assez d'avis » (rien sur la fiche) ; sans résumé : rien", () => {
    expect(texteNote({ resume: resume(null, 2), t: fr })).toBe("Pas encore assez d’avis");
    expect(texteNote({ resume: resume(null, 2), t: ar })).toBe("مازال ما كاينش بزاف تاع الآراء");
    expect(texteNote({ resume: resume(null, 2), t: fr, forme: "fiche" })).toBeNull();
    expect(renderToStaticMarkup(<NoteBoutique resume={null} t={fr} />)).toBe("");
  });
});

describe("US-32.3 : avis sur la vitrine", () => {
  it("note, critères les plus cités, derniers avis (« Amine B. · ★★★★★ · octobre 2026 »), réponse, « Voir tous les avis »", () => {
    const html = renderToStaticMarkup(<AvisBoutique resume={resume(4.6, 18)} avis={avis} slug="boutique-nour" t={fr} langue="fr" />);
    expect(html).toContain('id="avis"');
    expect(html).toContain("★ 4,6 · 18 avis");
    expect(html).toContain("Bon accueil · 12   Article conforme · 9"); expect(html).not.toContain("Rapide ·");
    expect(html).toContain("Amine B."); expect(html).toContain("★★★★★"); expect(html).toContain("octobre 2026");
    expect(html).toContain('aria-label="5 étoiles sur 5"');
    expect(html).toContain("Réponse de la boutique : Merci Amine, à bientôt !");
    expect(html).toContain("★★★☆☆"); expect(html).toContain("septembre 2026");
    expect(html).toContain('href="/b/boutique-nour/avis"'); expect(html).toContain("Voir tous les avis");
    // La mention du bon (US-32.5) n'est pas affichée tant que la récompense n'existe pas.
    expect(html).not.toContain("petit bon");
  });
  it("sous le seuil : « Pas encore assez d'avis », les commentaires s'affichent dès le premier ; pas de « Voir tous » si tout est affiché", () => {
    const html = renderToStaticMarkup(<AvisBoutique resume={resume(null, 1, { accueil: 0, article_conforme: 0, rapidite: 0 })} avis={[avis[0]]} slug="kids" t={fr} langue="fr" />);
    expect(html).toContain("Pas encore assez d’avis"); expect(html).toContain("Très bon accueil");
    expect(html).not.toContain("Voir tous les avis");
  });
  it("aucun avis : « Aucun avis pour le moment. »", () => {
    expect(renderToStaticMarkup(<AvisBoutique resume={resume(null, 0, { accueil: 0, article_conforme: 0, rapidite: 0 })} avis={[]} slug="x" t={fr} langue="fr" />)).toContain("Aucun avis pour le moment.");
  });
  it("en arabe : « ★ 4,6 · 18 راي », mois en arabe, commentaire dans sa langue", () => {
    const html = renderToStaticMarkup(<AvisBoutique resume={resume(4.6, 18)} avis={avis} slug="boutique-nour" t={ar} langue="ar" />);
    expect(html).toContain("★ 4,6 · 18 راي"); expect(html).toContain("أكتوبر 2026"); expect(html).toContain("آراء الكليان");
    expect(html).toContain('dir="auto"');
  });
});
