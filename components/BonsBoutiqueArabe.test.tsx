// US-35 (suite, BOLOSS 10/10) : bloc « Bons à rembourser » de l'espace en arabe ; le français ne change pas
// (tests de components/ParrainageAdmin.test.tsx).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BonsBoutique from "./BonsBoutique";
import { textesDe } from "@/lib/textes";
import { origineLigne, textePlafond, totauxParOrigine } from "@/lib/bons-boutique";
import { etatReleveBoutique } from "@/lib/parrainage-admin";

const t = textesDe("ar").espace.bons;
const maintenant = new Date("2026-10-09T12:00:00Z");
const ligne = (id: string, montant: number, origine: string | null, programme_id: string | null = null, statut = "a_rembourser", part_boutique = 0) =>
  ({ id, numero_commande: 200 + Number(id), remise_le: "2026-10-05T13:32:00Z", montant, statut, origine, programme_id, part_boutique });
const releves = [
  { id: "c", mois: "2026-10-01", nombre: 4, montant: 1600, statut: "en_cours", paye_le: null, reference_paiement: null, lignes: [
    ligne("1", 500, "campagne", "p1"), ligne("2", 500, "campagne", "p1"), ligne("3", 300, "bienvenue"), ligne("4", 300, "parrainage_filleul"),
    ligne("5", 300, null, null, "refuse"), ligne("6", 500, "inscription_boutique", null, "a_rembourser", 250)] },
  { id: "s", mois: "2026-09-01", nombre: 8, montant: 2400, statut: "a_payer", paye_le: null, reference_paiement: null, lignes: [] },
  { id: "a", mois: "2026-08-01", nombre: 2, montant: 1000, statut: "paye", paye_le: "2026-09-05", reference_paiement: "VIR-12", lignes: [] },
];
const sansBalises = (html: string) => html.replace(/<[^>]+>/g, "").replace(/[\u2066\u2069]/g, "").replace(/[\u00a0\u202f]/g, " "); // balises et isolants des prix

describe("US-35 : bons à rembourser en arabe", () => {
  const html = renderToStaticMarkup(<BonsBoutique maintenant={maintenant} noms={new Map([["p1", "Aïd 2026"]])} langue="ar"
    plafonds={[{ nom_fr: "Aïd 2026", nom_ar: "العيد 2026", plafond: 30, utilises: 14 }]} releves={releves} />);
  const texte = sansBalises(html);

  it("titre, mois en cours, origines, plafond (nom arabe), relevés passés, détail, explications : en arabe", () => {
    expect(texte).toContain(t.titre);
    expect(texte).toContain("هاد الشهر: 4 بونات · 1 600 دج");
    expect(texte).toContain("Aïd 2026 · 2 بونات"); expect(texte).toContain("مرحبا · 1 بون"); expect(texte).toContain("العرضة · 1 بون");
    expect(texte).toContain("التسجيل في الحانوت · 1 بون");
    expect(texte).toContain("الحد تاع العيد 2026: 14 / 30 بون في الحانوت نتاعك.");
    expect(texte).toContain("سبتمبر: 2 400 دج · يتخلّص قبل 10/10");
    expect(texte).toContain("أوت: 1 000 دج · تخلّص نهار 05/09، المرجع VIR-12");
    expect(texte).toContain(t.detail); expect(texte).toContain("رقم 201 · Aïd 2026 · 05/10/2026 14:32"); expect(texte).toContain("رقم 205 · العرضة · ");
    expect(texte).toContain(t.etatRefuse);
    expect(texte).toContain(t.partBoutique); expect(texte).toContain(t.explication);
  });

  it("plus rien en français (sauf le nom de la campagne saisi en français), prix en « دج » isolés, numéros et dates de gauche à droite", () => {
    expect(texte).not.toMatch(/\bDA\b|Bons à rembourser|Ce mois-ci|Plafond|Parrainage|Bienvenue|Détail|à payer|N° /);
    expect(html).toMatch(/<bdi dir="rtl" data-prix="">\u20661\s000\u2069\sدج<\/bdi>/);
    expect(html).toContain('<bdi dir="ltr">201</bdi>'); expect(html).toContain('<bdi dir="ltr">05/10/2026 14:32</bdi>');
    expect(html).toContain('<bdi dir="ltr">10/10</bdi>'); expect(html).toContain('<bdi dir="ltr">14 / 30</bdi>'); // « 14 / 30 » d'un seul bloc
    expect(html).toContain("<bdi>Aïd 2026</bdi>");
    expect(html).toContain('aria-label="حسب المصدر"');
  });

  it("sans relevé du mois : « 0 بون · 0 دج »", () => {
    const vide = sansBalises(renderToStaticMarkup(<BonsBoutique releves={[]} langue="ar" plafonds={[{ nom_fr: "Aïd 2026", nom_ar: "", plafond: 30, utilises: 0 }]} />));
    expect(vide).toContain("هاد الشهر: 0 بون · 0 دج");
    expect(vide).toContain("الحد تاع Aïd 2026: 0 / 30 بون"); // pas de nom arabe : le nom français
  });

  it("le français ne change pas (fonctions de lib/ par défaut)", () => {
    expect(origineLigne({ origine: "inscription_boutique", programme_id: null }, new Map())).toBe("Inscription en boutique");
    expect(totauxParOrigine([ligne("1", 300, "bienvenue")], new Map())[0].origine).toBe("Bienvenue");
    expect(textePlafond({ nom_fr: "Aïd 2026", nom_ar: "", plafond: 30, utilises: 14 })).toBe("Plafond Aïd 2026 : 14 / 30 bons dans votre boutique.");
    expect(etatReleveBoutique(releves[2])).toBe("Août : 1 000 DA · payé le 05/09, réf. VIR-12");
    expect(etatReleveBoutique(releves[1])).toBe("Septembre : 2 400 DA · à payer avant le 10/10");
    expect(etatReleveBoutique({ ...releves[0], statut: "en_cours" })).toBe("Octobre : 1 600 DA · en cours");
  });
});
