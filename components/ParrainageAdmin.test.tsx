import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BonsBoutique from "./BonsBoutique";
import BudgetParrainage from "./BudgetParrainage";
import ParrainagesAdmin from "./ParrainagesAdmin";
import RelevesAdmin from "./RelevesAdmin";
import type { ParrainageAdmin, ReleveAdmin } from "@/lib/parrainage-admin";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/admin/parrainages/actions", () => ({ reglerBudgetParrainage: vi.fn(), annulerBonsParrainage: vi.fn(), exclureCompteDuParrainage: vi.fn(), retirerBoutiqueDesBons: vi.fn() }));
vi.mock("@/app/admin/remboursements/actions", () => ({ mettreLigneDeCote: vi.fn(), deciderLigneDeCote: vi.fn(), marquerRelevePaye: vi.fn() }));

const p: ParrainageAdmin = { filleul_id: "f", parrain_id: "P", statut: "valide", cree_le: "2026-10-01T10:00:00Z", valide_le: "2026-10-05T10:00:00Z", motif: null,
  filleul: { id: "f", nom: "Samia Benkhaled", telephone: "+213555123456", cree_le: "2026-10-01T10:00:00Z", parrainage_exclu: false, bloque: false },
  parrain: { id: "P", nom: "Karim Mansouri", telephone: "+213661987654", cree_le: "2026-09-01T10:00:00Z", parrainage_exclu: false, bloque: false },
  commande: { numero: 128, total: 3500, mode_remise: "qr", cree_le: "2026-10-04T10:00:00Z", prete_le: "2026-10-04T12:00:00Z", terminee_le: "2026-10-05T10:00:00Z" },
  boutique: { id: "B", nom: "Boutique Nour", bons_acceptes: true }, bons: [{ id: "1", origine: "parrainage_filleul", statut: "disponible" }, { id: "2", origine: "parrainage_parrain", statut: "utilise" }] };

const releve: ReleveAdmin = { id: "r", mois: "2026-09-01", nombre: 2, montant: 600, statut: "a_payer", cloture_le: "2026-09-30T23:10:00Z", paye_le: null, reference_paiement: null,
  boutique: { id: "B", nom: "Boutique Nour", slug: "boutique-nour", bons_acceptes: true },
  lignes: [{ id: "l", releve_id: "r", numero_commande: 128, remise_le: "2026-09-05T13:32:00Z", mode_remise: "code", client: "Samia B.", total_commande: 3500, montant: 300, statut: "a_rembourser", motif: null, commande: null },
    { id: "m", releve_id: "r", numero_commande: 131, remise_le: "2026-09-06T13:32:00Z", mode_remise: "code", client: "Amine K.", total_commande: 2100, montant: 300, statut: "a_rembourser", motif: null, commande: null }] };

describe("US-27.5 admin", () => {
  it("budget : résumé et champ de réglage", () => {
    const html = renderToStaticMarkup(<BudgetParrainage budget={{ mois: "2026-10-01", actif: false, budget: 30000, emis: 9600, utilise: 3600, en_file: 0, restant: 20400 }} />);
    expect(html).toContain("Budget d’octobre : 9 600 DA émis sur 30 000 DA · 3 600 DA utilisés");
    expect(html).toContain("Budget mensuel (DA)"); expect(html).toContain('value="30000"');
    expect(html).toContain("fermé (interrupteur « parrainage »)");
  });
  it("parrainages : numéros masqués, signal, actions", () => {
    const html = renderToStaticMarkup(<ParrainagesAdmin parrainages={[p]} signaux={{ f: ["Remise 9 min après « Prête »"] }} />);
    expect(html).toContain("0555 •• •• 56"); expect(html).not.toContain("123456"); expect(html).not.toContain("+213");
    expect(html).toContain("Signal : Remise 9 min après « Prête »"); expect(html).toContain("1 avec signal");
    expect(html).toContain("Annuler les bons"); expect(html).toContain("Exclure le parrain"); expect(html).toContain("Retirer la boutique des bons");
    expect(html).toContain("Commande n° 128 · 3 500 DA · Boutique Nour · QR code"); expect(html).toContain("Bons : filleul disponible · parrain utilisé");
  });
  it("parrainage sans bon annulable : pas de bouton « Annuler les bons »", () => {
    const html = renderToStaticMarkup(<ParrainagesAdmin parrainages={[{ ...p, bons: [{ id: "2", origine: "parrainage_parrain", statut: "utilise" }] }]} signaux={{}} />);
    expect(html).not.toContain(">Annuler les bons<");
  });
  it("relevés : mois, export, total, signal code, « Marquer comme payé » sur un relevé à payer", () => {
    const html = renderToStaticMarkup(<RelevesAdmin mois="2026-09-01" moisPossibles={["2026-10-01", "2026-09-01"]} releves={[releve]} deCote={[]} aujourdhui="2026-10-09" />);
    expect(html).toContain('href="/admin/remboursements/export?mois=2026-09"'); expect(html).toContain("Septembre 2026 : 2 bons · 600 DA à rembourser");
    expect(html).toContain("À payer"); expect(html).toContain("Signal : Toujours par code à 4 chiffres, jamais par QR code");
    expect(html).toContain("Marquer comme payé"); expect(html).toContain("Mettre de côté"); expect(html).toContain("boutique=B");
  });
  it("relevé payé : date et référence, plus d’action", () => {
    const html = renderToStaticMarkup(<RelevesAdmin mois="2026-09-01" moisPossibles={["2026-09-01"]} releves={[{ ...releve, statut: "paye", paye_le: "2026-10-05", reference_paiement: "CCP-1234" }]} deCote={[]} aujourdhui="2026-10-09" />);
    expect(html).toContain("Payé le 05/10/2026 · réf. CCP-1234"); expect(html).not.toContain(">Marquer comme payé<"); expect(html).not.toContain("Mettre de côté");
  });
  it("lignes mises de côté : Rembourser / Refuser", () => {
    const html = renderToStaticMarkup(<RelevesAdmin mois="2026-10-01" moisPossibles={["2026-10-01"]} releves={[]} deCote={[{ ...releve.lignes[0], statut: "de_cote", motif: "Remise suspecte", boutique: { nom: "Boutique Nour" } }]} aujourdhui="2026-10-09" />);
    expect(html).toContain("Aucun bon utilisé ce mois-ci."); expect(html).toContain("Lignes mises de côté (1)"); expect(html).toContain("motif : Remise suspecte");
    expect(html).toContain(">Rembourser<"); expect(html).toContain(">Refuser<");
  });
});

describe("US-27.5 bloc boutique", () => {
  it("rien sans relevé", () => { expect(renderToStaticMarkup(<BonsBoutique releves={[]} />)).toBe(""); });
  it("mois en cours, relevés passés, détail sans téléphone", () => {
    const html = renderToStaticMarkup(<BonsBoutique maintenant={new Date("2026-10-09T12:00:00Z")} releves={[
      { id: "c", mois: "2026-10-01", nombre: 4, montant: 1200, statut: "en_cours", paye_le: null, reference_paiement: null, lignes: [{ id: "l", numero_commande: 140, remise_le: "2026-10-05T13:32:00Z", montant: 300, statut: "a_rembourser" }] },
      { id: "s", mois: "2026-09-01", nombre: 8, montant: 2400, statut: "a_payer", paye_le: null, reference_paiement: null, lignes: [] }]} />);
    expect(html).toContain("Ce mois-ci : 4 bons · 1 200 DA"); expect(html).toContain("Septembre : 2 400 DA · à payer avant le 10/10");
    expect(html).toContain("N° 140 · 05/10/2026 14:32");
  });
});
