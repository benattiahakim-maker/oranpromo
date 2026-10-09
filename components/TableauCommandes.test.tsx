import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import TableauCommandes from "./TableauCommandes";
import type { CommandeRecue } from "@/lib/commandes";

const { changerStatutCommandeBoutique, changerStatutCommandesBoutique, declarerClientPasVenu, refresh } = vi.hoisted(() => ({ changerStatutCommandeBoutique: vi.fn(), changerStatutCommandesBoutique: vi.fn(), declarerClientPasVenu: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/espace/commandes/actions", () => ({ changerStatutCommandeBoutique, changerStatutCommandesBoutique, declarerClientPasVenu }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); changerStatutCommandeBoutique.mockResolvedValue({ succes: true, message: "Commande mise à jour." }); });

const MAINTENANT = Date.parse("2026-10-09T13:05:00Z");
const commande = (statut: CommandeRecue["statut"], extra: Partial<CommandeRecue> = {}): CommandeRecue => ({ id: `c-${statut}`, numero: 127, client_id: "k", boutique_id: "b1", statut, client_nom: "Amine Benali", client_telephone: "+213555123456", note: null, motif_annulation: null, total: 6300, cree_le: "2026-10-09T12:23:00Z", confirmee_le: null, prete_le: null, expire_le: statut === "prete" ? "2026-10-09T14:25:00Z" : null, terminee_le: null, no_show_le: null, no_show_annule_le: null, contestee_le: null, contestation_validee_le: null, telephone_verifie: true, langue: "fr", mode_remise: null, bon_id: null, remise_bon: 0, lignes_commande: [{ id: "l1", commande_id: "c", article_id: "a", titre: "Eau de parfum", taille: "50 ml", quantite: 2, prix_unitaire: 3150 }], ...extra });
const afficher = (commandes: CommandeRecue[], etape: Parameters<typeof TableauCommandes>[0]["etape"] = "a_confirmer") => render(<TableauCommandes commandes={commandes} etape={etape} boutique="Parfumerie Démo" maintenant={MAINTENANT} />);

describe("US-28.1 : lignes serrées", () => {
  it("une ligne : n°, prénom (sans téléphone), pièces, heure, urgence en rouge avec son texte", () => {
    afficher([commande("demandee")]);
    const ligne = screen.getByRole("button", { name: /127/ });
    expect(ligne).toHaveTextContent("N° 127 · Amine");
    expect(ligne).toHaveTextContent("2 articles · reçue à 13 h 23");
    expect(ligne).not.toHaveTextContent("0555");
    expect(ligne).not.toHaveTextContent("Benali");
    const u = within(ligne).getByText(/attend depuis 42 min/);
    expect(u.className).toContain("text-erreur");
  });
  it("décision 8 : montant à encaisser après le bon, avec l’étiquette « Bon −300 »", () => {
    afficher([commande("demandee", { bon_id: "b", remise_bon: 300 })]);
    const ligne = screen.getByRole("button", { name: /127/ });
    expect(ligne).toHaveTextContent(/6\s000 DA/);
    expect(within(ligne).getByText("Bon −300")).toBeInTheDocument();
  });
  it("sans bon : le total, pas d’étiquette", () => {
    afficher([commande("demandee")]);
    expect(screen.getByRole("button", { name: /127/ })).toHaveTextContent(/6\s300 DA/);
    expect(screen.queryByText(/Bon −/)).toBeNull();
  });
  it("prête : « expire dans 1 h 20 » en rouge", () => {
    afficher([commande("prete", { prete_le: "2026-10-08T14:25:00Z" })], "pretes");
    const ligne = screen.getByRole("button", { name: /127/ });
    expect(ligne).toHaveTextContent("prête hier 15 h 25");
    expect(within(ligne).getByText(/expire dans 1 h 20/).className).toContain("text-erreur");
  });
  it("étape vide et recherche vide", () => {
    afficher([], "a_preparer");
    expect(screen.getByText("Aucune commande à préparer.")).toBeInTheDocument();
    cleanup();
    afficher([], null);
    expect(screen.getByText("Aucune commande ne correspond.")).toBeInTheDocument();
  });
  it("recherche : l’étape de chaque commande est dans la ligne", () => {
    afficher([commande("prete"), commande("recuperee", { id: "c2", numero: 97, terminee_le: "2026-10-02T10:00:00Z" })], null);
    expect(screen.getByRole("button", { name: /127/ })).toHaveTextContent("Prêtes");
    expect(screen.getByRole("button", { name: /97/ })).toHaveTextContent("Terminées");
  });
});

describe("US-28.1 : détail déplié avec les boutons d’aujourd’hui", () => {
  it("toucher la ligne déplie le détail ; une seule commande dépliée à la fois", () => {
    afficher([commande("demandee"), commande("demandee", { id: "c2", numero: 129, client_nom: "Sara" })]);
    const l1 = screen.getByRole("button", { name: /127/ }), l2 = screen.getByRole("button", { name: /129/ });
    expect(l1).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(l1);
    expect(l1).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Amine Benali · Demandée")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0555 12 34 56 · WhatsApp" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Confirmer" })).toHaveLength(3); // 2 lignes (ordinateur) + détail
    fireEvent.click(l2);
    expect(l1).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Amine Benali · Demandée")).toBeNull();
  });
  it("prête : « Remis sans QR code » reste derrière sa confirmation, « Scanner » dans la ligne", async () => {
    afficher([commande("prete")], "pretes");
    expect(screen.getByRole("link", { name: "Scanner" })).toHaveAttribute("href", "/espace/scanner");
    fireEvent.click(screen.getByRole("button", { name: /127/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remis sans QR code" }));
    expect(changerStatutCommandeBoutique).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la remise" }));
    await waitFor(() => expect(changerStatutCommandeBoutique).toHaveBeenCalledWith("c-prete", "recuperee", null, ""));
  });
  it("le bouton de la ligne (ordinateur) appelle la même action ; un refus de stock ouvre le détail avec le message", async () => {
    afficher([commande("demandee")]);
    const [boutonLigne] = screen.getAllByRole("button", { name: "Confirmer" });
    fireEvent.click(boutonLigne);
    await waitFor(() => expect(changerStatutCommandeBoutique).toHaveBeenCalledWith("c-demandee", "confirmee", null, ""));
    expect(refresh).toHaveBeenCalled();
    changerStatutCommandeBoutique.mockResolvedValueOnce({ succes: false, message: "Stock insuffisant pour « Polo » en taille M : il reste 1 pièce(s), la commande en demande 2." });
    fireEvent.click(screen.getAllByRole("button", { name: "Confirmer" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Stock insuffisant pour « Polo »");
    expect(screen.getByRole("link", { name: "Corriger le stock dans Mes articles" })).toHaveAttribute("href", "/espace");
    expect(screen.getByRole("button", { name: /127/ })).toHaveAttribute("aria-expanded", "true");
  });
  it("double clic sur le bouton de la ligne = un seul envoi", async () => {
    let fin: (v: unknown) => void = () => {};
    changerStatutCommandeBoutique.mockReturnValueOnce(new Promise(r => { fin = r; }));
    afficher([commande("confirmee")], "a_preparer");
    const bouton = screen.getAllByRole("button", { name: "Prête" })[0];
    fireEvent.click(bouton); fireEvent.click(bouton);
    fin({ succes: true, message: "ok" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(changerStatutCommandeBoutique).toHaveBeenCalledTimes(1);
  });
});

describe("US-28.2 : actions groupées", () => {
  const trois = () => [commande("demandee", { id: "a", numero: 127 }), commande("demandee", { id: "b", numero: 129 }), commande("demandee", { id: "c", numero: 131 })];
  it("cases sur « À confirmer » et « À préparer » seulement (pas sur Prêtes, Terminées ni la recherche)", () => {
    afficher(trois());
    expect(screen.getAllByRole("checkbox")).toHaveLength(4); // Tout cocher + 3
    for (const etape of ["pretes", "terminees", null] as const) { cleanup(); afficher([commande("prete")], etape); expect(screen.queryAllByRole("checkbox")).toHaveLength(0); }
  });
  it("barre d’action : « Confirmer les 2 », puis compte rendu ; les échouées restent cochées", async () => {
    changerStatutCommandesBoutique.mockResolvedValue({ succes: true, message: "", reussies: [{ id: "a", numero: 127 }], echecs: [{ id: "c", numero: 131, message: "Stock insuffisant pour « Polo » en taille M : il reste 1 pièce(s), la commande en demande 2.", deja: false }] });
    afficher(trois());
    expect(screen.queryByRole("button", { name: /Confirmer les/ })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Cocher la commande n° 127" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cocher la commande n° 131" }));
    expect(screen.getByText(/2 commandes cochées/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer les 2" }));
    await waitFor(() => expect(changerStatutCommandesBoutique).toHaveBeenCalledWith(["a", "c"], "confirmee"));
    const rapport = await screen.findByRole("status");
    expect(rapport).toHaveTextContent("1 commande confirmée.");
    expect(rapport).toHaveTextContent("N° 131 non confirmée : Stock insuffisant pour « Polo »");
    expect(screen.getByRole("checkbox", { name: "Cocher la commande n° 131" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Cocher la commande n° 127" })).not.toBeChecked();
    expect(refresh).toHaveBeenCalled();
    fireEvent.click(within(rapport).getByRole("button", { name: "Voir" }));
    expect(screen.getByRole("button", { name: /131/ })).toHaveAttribute("aria-expanded", "true");
  });
  it("« Tout cocher » puis « Décocher » ; « Marquer prêtes (3) » sur « À préparer »", () => {
    afficher(trois().map(c => ({ ...c, statut: "confirmee" as const })), "a_preparer");
    fireEvent.click(screen.getByRole("checkbox", { name: /Tout cocher \(3\)/ }));
    expect(screen.getByRole("button", { name: "Marquer prêtes (3)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Décocher" }));
    expect(screen.queryByRole("button", { name: /Marquer prêtes/ })).toBeNull();
  });
  it("plus de 20 cochées : « 20 au plus à la fois », rien n’est envoyé", () => {
    afficher(Array.from({ length: 21 }, (_, i) => commande("demandee", { id: `x${i}`, numero: 200 + i })));
    fireEvent.click(screen.getByRole("checkbox", { name: /Tout cocher/ }));
    const bouton = screen.getByRole("button", { name: "20 au plus à la fois" });
    expect(bouton).toBeDisabled();
    fireEvent.click(bouton);
    expect(changerStatutCommandesBoutique).not.toHaveBeenCalled();
  });
  it("double touche = un seul envoi", async () => {
    let fin: (v: unknown) => void = () => {};
    changerStatutCommandesBoutique.mockReturnValueOnce(new Promise(r => { fin = r; }));
    afficher(trois());
    fireEvent.click(screen.getByRole("checkbox", { name: "Cocher la commande n° 127" }));
    const bouton = screen.getByRole("button", { name: "Confirmer la commande" });
    fireEvent.click(bouton); fireEvent.click(bouton);
    fin({ succes: true, message: "", reussies: [{ id: "a", numero: 127 }], echecs: [] });
    expect(await screen.findByRole("status")).toHaveTextContent("1 commande confirmée.");
    expect(changerStatutCommandesBoutique).toHaveBeenCalledTimes(1);
  });
});
