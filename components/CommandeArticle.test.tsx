import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import CommandeArticle from "./CommandeArticle";
import { CLE_PANIER } from "@/lib/panier";

afterEach(cleanup);
const { enregistrerEvenement } = vi.hoisted(() => ({ enregistrerEvenement: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/evenements", () => ({ enregistrerEvenement }));
beforeEach(() => { localStorage.clear(); enregistrerEvenement.mockClear(); });
const article = { articleId: "1234", boutique: { id: "boutique", nom: "Boutique Amine", whatsapp: "+213555123456" }, titre: "Polo bleu", prix: 3500, photo: null };
const panier = () => JSON.parse(localStorage.getItem(CLE_PANIER) ?? "null");

describe("ajouter au panier depuis la fiche (US-20.2)", () => {
  it("demande une taille, limite la quantité au stock et ajoute au panier", () => {
    render(<CommandeArticle {...article} tailles={[{ libelle: "S", quantite: 0 }, { libelle: "M", quantite: 2 }]} />);
    expect(screen.getByRole("button", { name: "Ajouter au panier" })).toBeDisabled();
    expect(screen.getByLabelText("Taille S, épuisée")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Taille M"));
    fireEvent.click(screen.getByRole("button", { name: "Une pièce de plus" }));
    expect(screen.getByRole("button", { name: "Une pièce de plus" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(panier()).toEqual({ boutiqueId: "boutique", boutiqueNom: "Boutique Amine", lignes: [{ articleId: "1234", titre: "Polo bleu", taille: "M", quantite: 2, prix: 3500, photo: null }] });
    expect(screen.getByRole("status")).toHaveTextContent("Ajouté au panier.");
    expect(screen.getByRole("link", { name: "Voir le panier" })).toHaveAttribute("href", "/panier");
  });
  it("compte le clic comme une demande de réservation, sans donnée personnelle (US-08)", () => {
    render(<CommandeArticle {...article} tailles={[{ libelle: "Unique", quantite: 3 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(enregistrerEvenement).toHaveBeenCalledWith("clic_reserver", "boutique", "1234", "Unique");
  });
  it("propose de remplacer un panier d’une autre boutique", () => {
    localStorage.setItem(CLE_PANIER, JSON.stringify({ boutiqueId: "autre", boutiqueNom: "Maison Ilyes", lignes: [{ articleId: "x", titre: "Robe", taille: "38", quantite: 1, prix: 5000, photo: null }] }));
    render(<CommandeArticle {...article} tailles={[{ libelle: "Unique", quantite: 3 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Maison Ilyes");
    expect(panier().boutiqueId).toBe("autre");
    fireEvent.click(screen.getByRole("button", { name: "Vider le panier et ajouter" }));
    expect(panier().boutiqueId).toBe("boutique");
  });
  it("garde un lien WhatsApp pour poser une question", () => {
    render(<CommandeArticle {...article} tailles={[{ libelle: "M", quantite: 1 }]} />);
    const lien = screen.getByRole("link", { name: "Une question ? WhatsApp" }).getAttribute("href")!;
    expect(lien).toContain("https://wa.me/213555123456?");
    expect(new URL(lien).searchParams.get("text")).toContain("/a/1234 (vu sur BleDeal)");
  });
});

describe("US-23 : fiche en arabe", () => {
  it("« زيد للسلة » et « الخلاص في الحانوت » (textes validés), tailles et quantité en arabe", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><CommandeArticle {...article} tailles={[{ libelle: "S", quantite: 0 }, { libelle: "M", quantite: 2 }]} /></FournisseurTextes>);
    expect(screen.getByRole("button", { name: "زيد للسلة" })).toBeDisabled();
    expect(screen.getByLabelText("مقاس S، ما بقاش")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("مقاس M"));
    fireEvent.click(screen.getByRole("button", { name: "زيد للسلة" }));
    expect(screen.getByText(/تزادت للسلة/)).toBeInTheDocument();
    expect(screen.getByText(/الخلاص في الحانوت/)).toBeInTheDocument();
  });
});

describe("US-23 : erreurs du panier en arabe", () => {
  it("panier d’une autre boutique : message en arabe, nom de la boutique gardé", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    localStorage.setItem(CLE_PANIER, JSON.stringify({ boutiqueId: "autre", boutiqueNom: "Maison Ilyes", lignes: [{ articleId: "x", titre: "Robe", taille: "38", quantite: 1, prix: 5000, photo: null }] }));
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><CommandeArticle {...article} tailles={[{ libelle: "Unique", quantite: 3 }]} /></FournisseurTextes>);
    fireEvent.click(screen.getByRole("button", { name: "زيد للسلة" }));
    expect(screen.getByRole("alert")).toHaveTextContent("السلة فيها سلع من Maison Ilyes. الطلب يكون من حانوت واحد برك.");
  });
});

describe("US-25.1 : parfum, « Contenance » au lieu de « Taille »", () => {
  const parfum = { ...article, titre: "Eau de parfum rose et musc", prix: 3900, beaute: true, tailles: [{ libelle: "50 ml", quantite: 4 }, { libelle: "100 ml", quantite: 0 }] };
  it("français : légende, boutons, épuisée, consigne, et repère beauté dans le panier", () => {
    render(<CommandeArticle {...parfum} />);
    expect(screen.getByText("Contenance")).toBeInTheDocument();
    expect(screen.queryByText("Taille")).not.toBeInTheDocument();
    expect(screen.getByText("Choisissez une contenance pour commander.")).toBeInTheDocument();
    expect(screen.getByLabelText("100 ml, épuisée")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Contenance 50 ml"));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    expect(panier().lignes).toEqual([{ articleId: "1234", titre: "Eau de parfum rose et musc", taille: "50 ml", quantite: 1, prix: 3900, photo: null, beaute: true }]);
  });
  it("aucune contenance en stock", () => {
    render(<CommandeArticle {...parfum} tailles={[{ libelle: "50 ml", quantite: 0 }]} />);
    expect(screen.getByText("Aucune contenance disponible.")).toBeInTheDocument();
  });
  it("arabe : « الحجم », « 50 مل », « 100 مل، ما بقاش » ; la contenance enregistrée reste « 50 ml »", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><CommandeArticle {...parfum} /></FournisseurTextes>);
    expect(screen.getByText("الحجم")).toBeInTheDocument();
    expect(screen.getByText("اختار الحجم باش تطلب.")).toBeInTheDocument();
    expect(screen.getByLabelText("100 مل، ما بقاش")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("الحجم 50 مل"));
    fireEvent.click(screen.getByRole("button", { name: "زيد للسلة" }));
    expect(panier().lignes[0].taille).toBe("50 ml");
  });
  it("un vêtement garde « Taille »", () => {
    render(<CommandeArticle {...article} tailles={[{ libelle: "M", quantite: 1 }]} />);
    expect(screen.getByText("Taille")).toBeInTheDocument();
    expect(screen.getByText("Choisissez une taille pour commander.")).toBeInTheDocument();
  });
});
