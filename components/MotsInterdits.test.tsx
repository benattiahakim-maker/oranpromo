import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MotsInterdits from "./MotsInterdits";

const { ajouterMot, retirerMot, refresh } = vi.hoisted(() => ({ ajouterMot: vi.fn(), retirerMot: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/moderation/actions", () => ({ ajouterMot, retirerMot }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("US-32 : mots interdits (admin)", () => {
  it("liste les mots avec leur nombre et un bouton « Retirer » chacun", () => {
    render(<MotsInterdits mots={["fdp", "زبي"]} />);
    expect(screen.getByText("2 mots")).toBeTruthy();
    expect(screen.getAllByRole("listitem").map(li => li.textContent)).toEqual(["fdpRetirer", "زبيRetirer"]);
    expect(screen.getByRole("button", { name: "Retirer « زبي »" })).toBeTruthy();
  });
  it("liste vide : explique ce qui reste filtré", () => {
    render(<MotsInterdits mots={[]} />);
    expect(screen.getByText(/Aucun mot : seuls les liens et les numéros/)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
  it("ajoute : champ vidé, message, page rafraîchie ; bouton désactivé tant que le champ est vide", async () => {
    ajouterMot.mockResolvedValue({ succes: true, message: "« arnaque » ajouté à la liste." });
    render(<MotsInterdits mots={[]} />);
    const bouton = screen.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nouveau mot interdit"), { target: { value: "Arnaqué" } });
    fireEvent.click(bouton);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("« arnaque » ajouté à la liste."));
    expect(ajouterMot).toHaveBeenCalledWith("Arnaqué");
    expect((screen.getByLabelText("Nouveau mot interdit") as HTMLInputElement).value).toBe("");
    expect(refresh).toHaveBeenCalled();
  });
  it("refus de la base : message d'erreur, mot gardé dans le champ, pas de rafraîchissement", async () => {
    ajouterMot.mockResolvedValue({ succes: false, message: "Un seul mot, sans espace." });
    render(<MotsInterdits mots={[]} />);
    fireEvent.change(screen.getByLabelText("Nouveau mot interdit"), { target: { value: "deux mots" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Un seul mot, sans espace."));
    expect((screen.getByLabelText("Nouveau mot interdit") as HTMLInputElement).value).toBe("deux mots");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("retire un mot", async () => {
    retirerMot.mockResolvedValue({ succes: true, message: "« fdp » retiré de la liste." });
    render(<MotsInterdits mots={["fdp"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer « fdp »" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("« fdp » retiré de la liste."));
    expect(retirerMot).toHaveBeenCalledWith("fdp");
  });
});
