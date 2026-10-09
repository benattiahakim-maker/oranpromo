import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TableauDeBord from "./page";
const { verifier, charger } = vi.hoisted(() => ({ verifier: vi.fn(), charger: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creerClientServeur: async () => ({}) }));
vi.mock("@/lib/moderation", () => ({ verifierAdministrateur: verifier }));
vi.mock("@/lib/tableau-de-bord", () => ({ chargerTableauDeBord: charger }));
beforeEach(() => { vi.clearAllMocks(); verifier.mockResolvedValue("admin"); });
describe("tableau de bord administrateur", () => {
  it("refuse un ambassadeur avant toute lecture d’activité", async () => {
    verifier.mockRejectedValue(new Error("Accès réservé"));
    expect(renderToStaticMarkup(await TableauDeBord())).toContain("Accès réservé");
    expect(charger).not.toHaveBeenCalled();
  });
  it("affiche les sept compteurs et une relance avec la date", async () => {
    charger.mockResolvedValue({ boutiquesValidees: 1, boutiquesEnAttente: 2, articlesEnLigne: 3, promosEnCours: 4, clics7Jours: 5, clics30Jours: 6, signalementsOuverts: 7, aRelancer: [{ id: "b", nom: "Étoile", quartier: "Centre", whatsapp: "+213555123456", derniereMiseAJour: "2026-09-01T12:00:00Z" }] });
    const html = renderToStaticMarkup(await TableauDeBord());
    expect((html.match(/<dd/g) ?? []).length).toBe(7);
    expect(html).toContain("Étoile"); expect(html).toContain("Centre");
    expect(html).toContain('dateTime="2026-09-01T12:00:00Z"');
    expect(html).toContain("https://wa.me/213555123456?");
  });
  it("signale une erreur sans présenter de faux zéros", async () => {
    charger.mockRejectedValue(new Error("base indisponible"));
    const html = renderToStaticMarkup(await TableauDeBord());
    expect(html).toContain("Impossible de charger l’activité"); expect(html).not.toContain("<dd");
  });
});
