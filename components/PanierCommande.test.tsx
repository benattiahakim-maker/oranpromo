import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import PanierCommande from "./PanierCommande";
import { CLE_PANIER } from "@/lib/panier";

const { commanderPanier, push, refresh } = vi.hoisted(() => ({ commanderPanier: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/panier/actions", () => ({ commanderPanier }));
vi.mock("@/app/compte/actions", () => ({ enregistrerProfil: vi.fn(), enregistrerNom: vi.fn(), envoyerCodeVerification: vi.fn(), verifierCodeVerification: vi.fn() }));
vi.mock("@/app/compte/connexion/actions", () => ({ envoyerCodeConnexion: vi.fn(), verifierCodeConnexion: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh, replace: vi.fn() }) }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  localStorage.setItem(CLE_PANIER, JSON.stringify({ boutiqueId: "b1", boutiqueNom: "Boutique Amine", lignes: [{ articleId: "polo", titre: "Polo", taille: "M", quantite: 1, prix: 3500, photo: null }, { articleId: "chemise", titre: "Chemise", taille: "L", quantite: 1, prix: 5200, photo: null }] }));
});
const complet = { nom: "Samia", telephone: "+213555111222", complet: true, bloque: false, noShows: 0 };

describe("panier et commande (US-20.2)", () => {
  it("affiche le total et modifie les quantités", () => {
    render(<PanierCommande profil={complet} />);
    expect(screen.getByText("Boutique Amine")).toBeInTheDocument();
    expect(screen.getByText(/8\s700 DA/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Polo M : une pièce de plus" }));
    expect(screen.getByText(/12\s200 DA/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retirer Chemise (L)" }));
    expect(screen.queryByText("Chemise")).not.toBeInTheDocument();
  });
  it("envoie la commande puis vide le panier et ouvre le suivi", async () => {
    commanderPanier.mockResolvedValue({ id: "c1" });
    render(<PanierCommande profil={complet} />);
    fireEvent.change(screen.getByLabelText("Note pour la boutique (facultative)"), { target: { value: "Samedi" } });
    fireEvent.click(screen.getByRole("button", { name: "Commander" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/compte/commandes/c1"));
    expect(commanderPanier).toHaveBeenCalledWith("b1", [{ article_id: "polo", taille: "M", quantite: 1 }, { article_id: "chemise", taille: "L", quantite: 1 }], "Samedi");
    expect(localStorage.getItem(CLE_PANIER)).toBeNull();
  });
  it("affiche le refus de la base sans vider le panier", async () => {
    commanderPanier.mockResolvedValue({ erreur: "Il ne reste que 0 pièce(s) en taille M pour « Polo »." });
    render(<PanierCommande profil={complet} />);
    fireEvent.click(screen.getByRole("button", { name: "Commander" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Il ne reste que 0 pièce");
    expect(localStorage.getItem(CLE_PANIER)).not.toBeNull();
  });
  it("demande de se connecter, puis le nom et le téléphone avant la première commande", () => {
    const { unmount } = render(<PanierCommande profil={null} />);
    expect(screen.getByRole("link", { name: "Se connecter pour commander" })).toHaveAttribute("href", "/compte/connexion?suite=/panier");
    unmount();
    render(<PanierCommande profil={{ ...complet, telephone: null, complet: false }} />);
    expect(screen.getByLabelText("Téléphone WhatsApp")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Commander" })).not.toBeInTheDocument();
  });
  it("bloque la commande d’un compte bloqué et l’explique", () => {
    render(<PanierCommande profil={{ ...complet, bloque: true, noShows: 5 }} />);
    expect(screen.getByRole("button", { name: "Commander" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("bloqué");
  });
  it("affiche un panier vide", () => {
    localStorage.clear();
    render(<PanierCommande profil={complet} />);
    expect(screen.getByText("Votre panier est vide.")).toBeInTheDocument();
  });
  it("mode téléphone : numéro non vérifié → vérification par code au lieu de « Commander » (US-21.2)", () => {
    render(<PanierCommande profil={{ ...complet, complet: false, telephoneVerifie: false, verificationRequise: true }} />);
    expect(screen.getByText("Vérifiez votre numéro pour commander")).toBeInTheDocument();
    expect(screen.getByLabelText("Numéro de mobile")).toHaveValue("0555 11 12 22");
    expect(screen.queryByRole("button", { name: "Commander" })).not.toBeInTheDocument();
  });
  it("mode téléphone : numéro vérifié sans nom → le nom seul est demandé", () => {
    render(<PanierCommande profil={{ ...complet, nom: null, complet: false, telephoneVerifie: true, verificationRequise: true }} />);
    expect(screen.getByText("Avant votre première commande, indiquez votre nom.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nom et prénom")).toBeInTheDocument();
    expect(screen.queryByLabelText("Téléphone WhatsApp")).not.toBeInTheDocument();
  });
});

describe("US-23 : panier en arabe", () => {
  it("bouton « اطلب » (texte validé), total en دج, mention « الخلاص في الحانوت »", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><PanierCommande profil={complet} /></FournisseurTextes>);
    expect(screen.getByRole("button", { name: "اطلب" })).toBeInTheDocument();
    expect(screen.getByText("\u20668\u00a0700\u2069\u00a0دج", { normalizer: texte => texte })).toBeInTheDocument();
    expect(screen.getByText(/الخلاص في الحانوت/)).toBeInTheDocument();
    expect(screen.getByText("المجموع")).toBeInTheDocument();
  });
});

describe("US-23 : avertissement no-show en arabe", () => {
  it("compte bloqué : explication en arabe", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><PanierCommande profil={{ ...complet, bloque: true, noShows: 5 }} /></FournisseurTextes>);
    expect(screen.getByText(/حسابك تبلوكا من بعد 5/)).toBeInTheDocument();
  });
});

describe("US-25.1 : ligne de parfum dans le panier", () => {
  beforeEach(() => localStorage.setItem(CLE_PANIER, JSON.stringify({ boutiqueId: "b1", boutiqueNom: "Parfumerie Démo", lignes: [{ articleId: "oud", titre: "Eau de parfum oud boisé", taille: "100 ml", quantite: 1, prix: 4900, photo: null, beaute: true }, { articleId: "polo", titre: "Polo", taille: "M", quantite: 1, prix: 3500, photo: null }] })));
  it("français : « 100 ml · 4 900 DA » sans « Taille », le vêtement garde « Taille M »", () => {
    render(<PanierCommande profil={complet} />);
    expect(screen.getByText(/^100 ml · 4\s900 DA$/)).toBeInTheDocument();
    expect(screen.getByText(/^Taille M · 3\s500 DA$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eau de parfum oud boisé 100 ml : une pièce de plus" })).toBeInTheDocument();
  });
  it("arabe : « 100 مل » sans « مقاس »", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><PanierCommande profil={complet} /></FournisseurTextes>);
    const ligne = screen.getByText(/^100 مل · /);
    expect(ligne.textContent).not.toContain("مقاس");
    expect(screen.getByText(/^مقاس M · /)).toBeInTheDocument();
  });
});

describe("US-25.4 : refus de la base pour un parfum", () => {
  const refus = "Il ne reste que 1 pièce(s) en contenance 100 ml pour « Eau de parfum oud boisé ».";
  it("français : « contenance » affiché tel quel, panier gardé", async () => {
    commanderPanier.mockResolvedValue({ erreur: refus });
    render(<PanierCommande profil={complet} />);
    fireEvent.click(screen.getByRole("button", { name: "Commander" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(refus);
    expect(localStorage.getItem(CLE_PANIER)).not.toBeNull();
  });
});
