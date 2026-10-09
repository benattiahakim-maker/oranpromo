import { beforeEach, describe, expect, it, vi } from "vitest";
import { cheminSuite, emailValide, envoyerLienConnexion } from "./connexion";

const { signInWithOtp } = vi.hoisted(() => ({ signInWithOtp: vi.fn() }));
vi.mock("./supabase/client", () => ({ creerClientNavigateur: () => ({ auth: { signInWithOtp } }) }));
beforeEach(() => { signInWithOtp.mockReset(); });

describe("US-09 : e-mail", () => {
  it.each(["hakim@example.com", " vendeur+oran@boutique.fr ", "prenom.nom@shop.exemple.dz"])("accepte %s", email => {
    expect(emailValide(email)).toBe(true);
  });
  it.each(["", "vendeur", "@exemple.fr", "vendeur@", "a@@exemple.fr", "a b@exemple.fr", "a@localhost", "a@-exemple.fr", "a@exemple_.fr", ".a@exemple.fr", "a..b@exemple.fr", `${"a".repeat(65)}@exemple.fr`])("refuse %s", email => {
    expect(emailValide(email)).toBe(false);
  });
  it("envoie l’adresse nettoyée avec la destination callback prescrite", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    await envoyerLienConnexion(" hakim@example.com ", "http://localhost:3000");
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "hakim@example.com", options: { emailRedirectTo: "http://localhost:3000/auth/callback?suite=/espace" } });
  });
  it("n’envoie rien si l’adresse est invalide", async () => {
    await expect(envoyerLienConnexion("invalide", "http://localhost:3000")).rejects.toThrow("Saisissez une adresse e-mail valide.");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
  it("traduit un échec Supabase en français", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "Rate limit exceeded" } });
    await expect(envoyerLienConnexion("hakim@example.com", "http://localhost:3000")).rejects.toThrow("Impossible d’envoyer le lien");
  });
});

describe("US-09 : destination suite", () => {
  it("utilise /espace si suite est absente", () => { expect(cheminSuite(null)).toBe("/espace"); });
  it.each(["/espace", "/espace/articles?statut=disponible", "/catalogue?q=polo#resultats", "/"])("accepte %s", suite => { expect(cheminSuite(suite)).toBe(suite); });
  it.each(["", "espace", "https://exemple.com", "//exemple.com", "/\\exemple.com", "/%5cexemple.com", "/%2fexemple.com", "/a/..//exemple.com", "/%0d%0aLocation:evil", "/%ZZ", " /espace"])("refuse %s", suite => { expect(cheminSuite(suite)).toBeNull(); });
});
