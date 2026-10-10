// US-31.4 : écrans du bon de bienvenue de l'inscription en boutique (vitrine, Mes bons, relevés, espace, admin).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FournisseurTextes from "./FournisseurTextes";
import BienvenueBoutique from "./BienvenueBoutique";
import MesBons from "./MesBons";
import BoutonSuivre from "./BoutonSuivre";
import AbonnesBoutique from "./AbonnesBoutique";
import BonsBoutique from "./BonsBoutique";
import RelevesAdmin from "./RelevesAdmin";
import SignauxInscriptions from "./SignauxInscriptions";
import { fr } from "@/lib/textes/fr";
import { ar } from "@/lib/textes/ar";
import type { BonClient } from "@/lib/bons";
import type { ReleveAdmin, ReleveBoutique } from "@/lib/parrainage-admin";

const rattacherInscription = vi.fn();
vi.mock("@/app/compte/boutiques/actions", () => ({ rattacherInscription: (...a: unknown[]) => rattacherInscription(...a), nePlusSuivre: vi.fn(), seConnecterPourSuivre: vi.fn(), suivreApresConnexion: vi.fn(), suivreBoutique: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/admin/remboursements/actions", () => ({ mettreLigneDeCote: vi.fn(), deciderLigneDeCote: vi.fn(), marquerRelevePaye: vi.fn() }));
afterEach(cleanup);

describe("US-31.4 : vitrine après l'affiche", () => {
  it("bandeau avec l'offre (maquette, écran ⑧) ; sans offre, le bandeau de US-31.3 seul", () => {
    const html = renderToStaticMarkup(<BienvenueBoutique nom="Boutique Nour" slug="nour" t={fr.suivre} offre={{ montant: 500, minimum_achat: 4000 }} />);
    expect(html).toContain("Bon de bienvenue de 500\u00a0DA dès 4\u00a0000\u00a0DA d’achat, utilisable dès demain dans cette boutique, tout de suite ailleurs.");
    expect(html).toContain("Après vérification de votre numéro. Retrait par QR code.");
    expect(renderToStaticMarkup(<BienvenueBoutique nom="Boutique Nour" slug="nour" t={fr.suivre} />)).not.toContain("Bon de bienvenue");
  });
  it("en arabe", () => {
    const html = renderToStaticMarkup(<BienvenueBoutique nom="Boutique Nour" slug="nour" t={ar.suivre} offre={{ montant: 500, minimum_achat: 4000 }} langue="ar" />);
    expect(html).toContain("بون مرحبا");
    expect(html).toContain("دج");
  });
  it("après la connexion : « Votre bon de bienvenue est dans votre compte » ou « Vérifiez votre numéro »", async () => {
    rattacherInscription.mockResolvedValueOnce({ succes: true, suivie: true, rattache: true, bon: "donne" });
    render(<FournisseurTextes langue="fr" textes={fr}><BoutonSuivre boutiqueId="b" slug="nour" nom="Boutique Nour" connecte suivieAuDepart={false} apresConnexion="inscription" /></FournisseurTextes>);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Votre bon de bienvenue est dans votre compte, « Mes bons »."));
    cleanup();
    rattacherInscription.mockResolvedValueOnce({ succes: true, suivie: true, rattache: true, bon: "numero" });
    render(<FournisseurTextes langue="fr" textes={fr}><BoutonSuivre boutiqueId="b" slug="nour" nom="Boutique Nour" connecte suivieAuDepart={false} apresConnexion="inscription" /></FournisseurTextes>);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Vérifiez votre numéro dans votre compte pour recevoir votre bon de bienvenue."));
    cleanup();
    rattacherInscription.mockResolvedValueOnce({ succes: true, suivie: true, rattache: true, bon: null });
    render(<FournisseurTextes langue="fr" textes={fr}><BoutonSuivre boutiqueId="b" slug="nour" nom="Boutique Nour" connecte suivieAuDepart={false} apresConnexion="inscription" /></FournisseurTextes>);
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("✓ Suivie"));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("US-31.4 : Mes bons", () => {
  const bon: BonClient = { id: "i", montant: 500, statut: "disponible", origine: "inscription_boutique", cree_le: "2026-10-10T09:00:00Z",
    expire_le: "2026-11-09T09:00:00Z", utilise_le: null, commande: null, numero: null, boutique: null, minimum_achat: 4000, univers: null, villes: [],
    nom_fr: "Bienvenue en boutique", nom_ar: "مرحبا في الحانوت", utilisable_des: "2026-10-10T23:00:00Z", boutique_origine: "Boutique Nour" };
  it("« Bon de bienvenue », minimum, et « Chez Boutique Nour : dès le 11/10 » le jour de l'inscription", () => {
    render(<FournisseurTextes langue="fr" textes={fr}><MesBons bons={[bon]} maintenant={new Date("2026-10-10T12:00:00Z")} /></FournisseurTextes>);
    expect(screen.getByText("Bon de bienvenue")).toBeInTheDocument();
    expect(screen.getByText(/500.DA dès 4.000.DA d’achat · jusqu’au 9\/11/)).toBeInTheDocument();
    expect(screen.getByText("Chez Boutique Nour : dès le 11/10. Ailleurs : tout de suite.")).toBeInTheDocument();
  });
  it("le lendemain : plus de mention", () => {
    render(<FournisseurTextes langue="fr" textes={fr}><MesBons bons={[bon]} maintenant={new Date("2026-10-11T08:00:00Z")} /></FournisseurTextes>);
    expect(screen.queryByText(/Chez Boutique Nour/)).toBeNull();
  });
});

describe("US-31.4 : relevés, espace et admin", () => {
  const ligne = { id: "l", releve_id: "r", numero_commande: 140, remise_le: "2026-10-11T13:32:00Z", mode_remise: "qr", client: "Amine K.", total_commande: 4500,
    montant: 500, statut: "a_rembourser", motif: null, commande: null, origine: "inscription_boutique", part_boutique: 250, libelle_origine: "Inscription en boutique" };
  it("admin : ligne à 250 DA (bon 500 DA, part de la boutique 250 DA)", () => {
    const releve: ReleveAdmin = { id: "r", mois: "2026-10-01", nombre: 1, montant: 250, statut: "en_cours", cloture_le: null, paye_le: null, reference_paiement: null,
      boutique: { id: "B", nom: "Boutique Nour", slug: "nour", bons_acceptes: true }, lignes: [ligne] };
    const html = renderToStaticMarkup(<RelevesAdmin mois="2026-10-01" moisPossibles={["2026-10-01"]} releves={[releve]} deCote={[]} aujourdhui="2026-10-11" />);
    expect(html).toContain("1 bon · 250 DA");
    expect(html).toContain("bon 500 DA, part de la boutique 250 DA");
  });
  it("espace : ligne à 250 DA et explication de la part", () => {
    const releve: ReleveBoutique = { id: "r", mois: "2026-10-01", nombre: 1, montant: 250, statut: "en_cours", paye_le: null, reference_paiement: null, lignes: [ligne] };
    const html = renderToStaticMarkup(<BonsBoutique releves={[releve]} maintenant={new Date("2026-10-11T15:00:00Z")} />);
    expect(html).toContain("Inscription en boutique · 1 bon");
    expect(html).toContain("250 DA");
    expect(html).toContain("vous déduisez tout le bon en caisse et BleDeal vous rembourse le bon moins votre part");
  });
  it("espace : « dont 9 inscrits en boutique » et bons du mois", () => {
    const html = renderToStaticMarkup(<AbonnesBoutique abonnes={{ total: 12, sept_jours: 4, inscrits: 9, bons_inscription_mois: 3, plafond_inscriptions_mois: 20, montant_bon_inscription: 500, part_boutique: 250 }} />);
    expect(html).toContain("12 clients suivent votre boutique · +4 cette semaine · dont 9 inscrits en boutique");
    expect(html).toContain("Bons de bienvenue des inscrits ce mois : 3 / 20.");
  });
  it("admin : signaux des inscriptions, ou « Aucun signal »", () => {
    const html = renderToStaticMarkup(<SignauxInscriptions boutiques={[{ boutique_id: "b", boutique: "Boutique Nour", slug: "nour", inscrits: 6, sans_commande: 0, jamais_ailleurs: 0, remises_rapides: 2, meme_minute: 3 }]} />);
    expect(html).toContain("Boutique Nour</span> · 6 inscrits");
    expect(html).toContain("Signal : 2 commandes avec bon d’inscription remises moins de 30 min après la commande");
    expect(html).toContain("Signal : 3 inscriptions groupées (3 ou plus dans la même minute)");
    expect(renderToStaticMarkup(<SignauxInscriptions boutiques={[{ boutique_id: "b", boutique: "Calme", slug: "c", inscrits: 2, sans_commande: 0, jamais_ailleurs: 0, remises_rapides: 0, meme_minute: 0 }]} />))
      .toContain("Aucun signal sur les inscriptions en boutique.");
  });
});
