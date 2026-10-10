import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BlocRetrait from "./BlocRetrait";
import FournisseurTextes from "./FournisseurTextes";
import { ar } from "@/lib/textes/ar";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const QR = "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E";
const partage = { lien: "https://oranpromo.example/retrait/q7Kx2mPZ9vTfW8LrB4n1aE", whatsapp: "https://wa.me/?text=x" };

describe("US-26.2 : bloc « Mon QR code de retrait »", () => {
  it("QR code, code à 6 chiffres, montant à payer en espèces, luminosité", () => {
    render(<BlocRetrait qr={QR} code="048193" numero={128} total={6300} partage={partage} />);
    expect(screen.getByRole("region", { name: "Mon QR code de retrait" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "QR code de retrait de la commande n° 128" }).getAttribute("src")).toBe(QR);
    expect(screen.getByLabelText("Code de retrait").textContent).toBe("048193");
    // Suivi de la relecture n°6 : 6 cases, une par chiffre.
    expect([...screen.getByLabelText("Code de retrait").children].map(c => c.textContent)).toEqual(["0", "4", "8", "1", "9", "3"]);
    expect(screen.getByText("Pas de caméra ? Donnez ce code à 6 chiffres :")).toBeTruthy();
    expect(screen.getByText("À payer en espèces")).toBeTruthy();
    expect(screen.getByText(/6\s300\s*DA/)).toBeTruthy();
    expect(screen.getByText(/luminosité/)).toBeTruthy();
  });
  it("client : envoi à un proche par WhatsApp, copie du lien, avertissement", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<BlocRetrait qr={QR} code="048193" numero={128} total={6300} partage={partage} />);
    expect(screen.getByRole("link", { name: "Envoyer à un proche (WhatsApp)" }).getAttribute("href")).toBe(partage.whatsapp);
    expect(screen.getByText(/Toute personne qui a ce lien peut récupérer la commande/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Lien copié."));
    expect(writeText).toHaveBeenCalledWith(partage.lien);
  });
  it("copie refusée par le navigateur : message, pas d’erreur", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("non")) } });
    render(<BlocRetrait qr={QR} code="048193" numero={128} total={6300} partage={partage} />);
    fireEvent.click(screen.getByRole("button", { name: "Copier le lien" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Copie impossible"));
  });
  it("page du proche : pas de partage", () => {
    render(<BlocRetrait qr={QR} code="048193" numero={128} total={6300} />);
    expect(screen.queryByRole("link")).toBeNull(); expect(screen.queryByRole("button")).toBeNull();
  });
  it("arabe : textes de la story (darja), montant en دج, code gardé de gauche à droite", () => {
    render(<FournisseurTextes langue="ar" textes={ar}><BlocRetrait qr={QR} code="048193" numero={128} total={6300} partage={partage} /></FournisseurTextes>);
    expect(screen.getByRole("region", { name: "QR تاع الاستلام" })).toBeTruthy();
    expect(screen.getByText("ورّي هاد QR للبيّاع في الحانوت. تخلّص تمّا، كاش.")).toBeTruthy();
    expect(screen.getByText("تخلّص كاش")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ابعثو لواحد من دارك (واتساب)" })).toBeTruthy();
    expect(screen.getByLabelText("رقم الاستلام").getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("ما خدمتش الكاميرا؟ عطيه هاد الرقم تاع 6 أرقام:")).toBeTruthy();
    expect(screen.getByText(/دج/)).toBeTruthy();
  });
});
