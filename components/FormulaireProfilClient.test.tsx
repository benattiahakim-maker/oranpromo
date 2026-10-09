import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import FormulaireProfilClient from "./FormulaireProfilClient";

const { enregistrerProfil, enregistrerNom } = vi.hoisted(() => ({ enregistrerProfil: vi.fn(), enregistrerNom: vi.fn() }));
vi.mock("@/app/compte/actions", () => ({ enregistrerProfil, enregistrerNom }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); enregistrerProfil.mockResolvedValue({ succes: true, message: "Profil enregistré." }); enregistrerNom.mockResolvedValue({ succes: true, message: "Profil enregistré." }); });

describe("profil client (US-20.2, US-21.2)", () => {
  it("par défaut : nom et numéro saisis à la main", async () => {
    render(<FormulaireProfilClient nom="Samia" telephone="+213555123456" />);
    expect(screen.getByLabelText("Téléphone WhatsApp")).toHaveValue("0555 12 34 56");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(enregistrerProfil).toHaveBeenCalledWith({ nom: "Samia", telephone: "0555 12 34 56" }));
    expect(enregistrerNom).not.toHaveBeenCalled();
  });
  it("numéro vérifié ou mode téléphone : le nom seul, le numéro ne se modifie pas ici", async () => {
    render(<FormulaireProfilClient nom="" telephone="+213555123456" telephoneModifiable={false} />);
    expect(screen.queryByLabelText("Téléphone WhatsApp")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Votre nom doit contenir");
    fireEvent.change(screen.getByLabelText("Nom et prénom"), { target: { value: "Samia B" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(enregistrerNom).toHaveBeenCalledWith("Samia B"));
    expect(enregistrerProfil).not.toHaveBeenCalled();
  });
});

describe("US-23 : erreurs du profil en arabe", () => {
  it("nom vide : erreur en arabe", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><FormulaireProfilClient nom="" telephone="+213555123456" telephoneModifiable={false} /></FournisseurTextes>);
    fireEvent.click(screen.getByRole("button", { name: textesDe("ar").profil.enregistrer }));
    expect(await screen.findByRole("alert")).toHaveTextContent("الاسم لازم يكون من 2 حتى 60 حرف.");
    expect(enregistrerNom).not.toHaveBeenCalled();
  });
});
