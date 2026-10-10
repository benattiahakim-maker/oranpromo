import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmerCommande from "./ConfirmerCommande";

const { confirmer } = vi.hoisted(() => ({ confirmer: vi.fn() }));
vi.mock("@/app/confirmer/actions", () => ({ confirmerCommandeDepuisLien: confirmer }));
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe("US-20.6 : bouton « Confirmer la commande »", () => {
  it("rien n’est envoyé avant la touche ; confirmation puis lien vers l’espace", async () => {
    confirmer.mockResolvedValue({ succes: true, etat: "confirmee", message: "Commande confirmée : le stock est mis à jour. Pensez à la préparer." });
    render(<ConfirmerCommande jeton="lien" />);
    expect(confirmer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    expect((await screen.findByRole("status")).textContent).toContain("Commande confirmée : le stock est mis à jour.");
    expect(confirmer).toHaveBeenCalledWith("lien");
    expect(screen.getByRole("link", { name: "Voir mes commandes" }).getAttribute("href")).toBe("/espace/commandes");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("stock insuffisant : message du site et lien pour corriger", async () => {
    confirmer.mockResolvedValue({ succes: false, etat: "stock", message: "Stock insuffisant pour « Polo » en taille M." });
    render(<ConfirmerCommande jeton="lien" />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Stock insuffisant pour « Polo » en taille M.");
    expect(screen.getByRole("link", { name: "Corriger le stock ou annuler" }).getAttribute("href")).toBe("/espace/commandes");
  });
  it("déjà confirmée entre-temps : message, plus de bouton", async () => {
    confirmer.mockResolvedValue({ succes: false, etat: "deja_confirmee", message: "Cette commande est déjà confirmée." });
    render(<ConfirmerCommande jeton="lien" />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la commande" }));
    expect((await screen.findByRole("status")).textContent).toContain("Cette commande est déjà confirmée.");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("erreur passagère : le bouton reste pour réessayer ; double touche = un seul envoi", async () => {
    let fin: (v: unknown) => void = () => {};
    confirmer.mockReturnValueOnce(new Promise(r => { fin = r; }));
    render(<ConfirmerCommande jeton="lien" />);
    const bouton = screen.getByRole("button", { name: "Confirmer la commande" });
    fireEvent.click(bouton); fireEvent.click(bouton);
    fin({ succes: false, etat: "erreur", message: "La commande n’a pas pu être confirmée. Réessayez, ou confirmez-la dans votre espace BleDeal." });
    expect((await screen.findByRole("alert")).textContent).toContain("Réessayez");
    expect(confirmer).toHaveBeenCalledTimes(1);
    await waitFor(() => expect((screen.getByRole("button", { name: "Confirmer la commande" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
