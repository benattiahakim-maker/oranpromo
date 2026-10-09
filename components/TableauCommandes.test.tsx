import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import TableauCommandes from "./TableauCommandes";
import type { CommandeRecue } from "@/lib/commandes";

const { changerStatutCommandeBoutique, declarerClientPasVenu, refresh } = vi.hoisted(() => ({ changerStatutCommandeBoutique: vi.fn(), declarerClientPasVenu: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/espace/commandes/actions", () => ({ changerStatutCommandeBoutique, declarerClientPasVenu }));
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
