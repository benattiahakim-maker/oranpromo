import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import PanierCommande from "./PanierCommande";
import { CLE_PANIER } from "@/lib/panier";

const { commanderPanier, push, refresh } = vi.hoisted(() => ({ commanderPanier: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/panier/actions", () => ({ commanderPanier }));
vi.mock("@/app/compte/actions", () => ({ enregistrerProfil: vi.fn(), enregistrerNom: vi.fn(), envoyerCodeVerification: vi.fn(), verifierCodeVerification: vi.fn() }));
vi.mock("@/app/compte/parrainage/actions", () => ({ choisirParrain: vi.fn() }));
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
    expect(commanderPanier).toHaveBeenCalledWith("b1", [{ article_id: "polo", taille: "M", quantite: 1 }, { article_id: "chemise", taille: "L", quantite: 1 }], "Samedi", false, []);
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

describe("US-27 : bon et parrain au panier", () => {
  it("bon disponible : case cochée par défaut, « À payer en boutique 8 400 DA », commande avec le bon", async () => {
    commanderPanier.mockResolvedValue({ id: "c1" });
    render(<PanierCommande profil={complet} parrainage={{ bonDisponible: true, choix: null }} />);
    expect(screen.getByRole("checkbox", { name: "Utiliser mon bon parrainage (−300 DA)" })).toBeChecked();
    expect(screen.getByText("À payer en boutique").nextSibling).toHaveTextContent(/8\s400\sDA/);
    fireEvent.click(screen.getByRole("button", { name: "Commander" }));
    await waitFor(() => expect(commanderPanier).toHaveBeenCalledWith("b1", expect.any(Array), "", true, []));
    expect(push).toHaveBeenCalledWith("/compte/commandes/c1");
  });
  it("case décochée : commande sans bon", async () => {
    commanderPanier.mockResolvedValue({ id: "c1" });
    render(<PanierCommande profil={complet} parrainage={{ bonDisponible: true, choix: null }} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Commander" }));
    await waitFor(() => expect(commanderPanier).toHaveBeenCalledWith("b1", expect.any(Array), "", false, []));
  });
  it("bon non posé : le suivi s'ouvre avec la raison", async () => {
    commanderPanier.mockResolvedValue({ id: "c1", bon: "aucun_bon" });
    render(<PanierCommande profil={complet} parrainage={{ bonDisponible: true, choix: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Commander" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/compte/commandes/c1?bon=aucun_bon"));
  });
  it("pas de bon : pas de case ; parrain encore à choisir : champ « Ton parrain » pré-rempli", () => {
    render(<PanierCommande profil={complet} parrainage={{ bonDisponible: false, choix: { initial: "K7M2QX", parrainSaisi: false, saisies: 0 } }} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByLabelText("Ton parrain (facultatif) : son numéro WhatsApp ou son code")).toHaveValue("K7M2QX");
  });
  it("visiteur non connecté : ni bon ni champ du parrain", () => {
    render(<PanierCommande profil={null} parrainage={{ bonDisponible: true, choix: { initial: "", parrainSaisi: false, saisies: 0 } }} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByLabelText(/Ton parrain/)).toBeNull();
  });
});

describe("US-34.2 : nouvelle version des conditions au panier", () => {
  const conditions = [{ document: "conditions" as const, version: "2026-12-01" }];
  it("titre daté, case non cochée, « Accepter et commander » actif seulement après la case", async () => {
    commanderPanier.mockResolvedValue({ id: "c1" });
    render(<PanierCommande profil={complet} conditions={conditions} />);
    expect(screen.getByText("Nos conditions ont changé le 1/12/2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Commander" })).toBeNull();
    const bouton = screen.getByRole("button", { name: "Accepter et commander" });
    expect(bouton).toBeDisabled();
    const caseConditions = screen.getByRole("checkbox", { name: /J’accepte les conditions d’utilisation/ });
    expect(caseConditions).not.toBeChecked();
    fireEvent.click(caseConditions);
    fireEvent.click(bouton);
    await waitFor(() => expect(commanderPanier).toHaveBeenCalledWith("b1", expect.any(Array), "", false, conditions));
    expect(push).toHaveBeenCalledWith("/compte/commandes/c1");
  });
  it("refus du serveur (version changée) : message et page rechargée", async () => {
    commanderPanier.mockResolvedValue({ conditions: true, erreur: "Les conditions ont changé : rechargez la page." });
    render(<PanierCommande profil={complet} conditions={conditions} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /J’accepte/ }));
    fireEvent.click(screen.getByRole("button", { name: "Accepter et commander" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Les conditions ont changé");
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: /J’accepte/ })).not.toBeChecked();
  });
  it("arabe : « نقبل ونطلب »", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><PanierCommande profil={complet} conditions={conditions} /></FournisseurTextes>);
    expect(screen.getByRole("button", { name: "نقبل ونطلب" })).toBeDisabled();
    expect(screen.getByText("الشروط نتاعنا تبدلو نهار 1/12/2026")).toBeInTheDocument();
  });
});

describe("US-33.2 : plusieurs bons au panier", () => {
  const base = { utilise_le: null, commande: null, numero: null, boutique: null, univers: null, villes: [] as string[], cree_le: "2026-10-10T10:00:00Z" };
  const bienvenue = { ...base, id: "w", montant: 300, statut: "disponible" as const, origine: "bienvenue" as const, expire_le: "2099-11-09T10:00:00Z", minimum_achat: 2000, nom_fr: "Bienvenue", nom_ar: "مرحبا" };
  const aid = { ...base, id: "a", montant: 500, statut: "disponible" as const, origine: "campagne" as const, expire_le: "2099-11-09T10:00:00Z", minimum_achat: 4000, nom_fr: "Aïd 2026", nom_ar: "العيد 2026" };
  it("le plus gros bon utilisable est proposé (texte n° 9), commande avec le bon", async () => {
    commanderPanier.mockResolvedValue({ id: "c1" });
    render(<PanierCommande profil={complet} parrainage={{ bonDisponible: true, bons: [bienvenue, aid], choix: null }} />);
    expect(screen.getByRole("checkbox", { name: /^Utiliser mon bon Aïd 2026 \(−500\sDA\)$/ })).toBeChecked();
    expect(screen.getByText("À payer en boutique").nextSibling).toHaveTextContent(/8\s200\sDA/);
    fireEvent.click(screen.getByRole("button", { name: "Commander" }));
    await waitFor(() => expect(commanderPanier).toHaveBeenCalledWith("b1", expect.any(Array), "", true, []));
  });
  it("aucun bon utilisable : raison affichée, commande sans bon", async () => {
    commanderPanier.mockResolvedValue({ id: "c1" });
    render(<PanierCommande profil={complet} parrainage={{ bonDisponible: true, bons: [{ ...bienvenue, minimum_achat: 10000 }], choix: null }} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/Bon de bienvenue · Dès 10\s000\sDA d’achat/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Commander" }));
    await waitFor(() => expect(commanderPanier).toHaveBeenCalledWith("b1", expect.any(Array), "", false, []));
  });
});
