import { beforeEach, describe, expect, it, vi } from "vitest";
import { cheminSuite, cheminSuiteClient, emailValide, envoyerLienConnexion, pageConnexion } from "./connexion";

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
  it("transmet le jeton anti-robot Turnstile quand il y en a un (US-21)", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    await envoyerLienConnexion("hakim@example.com", "http://localhost:3000", "/espace", "jeton-captcha");
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "hakim@example.com", options: { emailRedirectTo: "http://localhost:3000/auth/callback?suite=/espace", captchaToken: "jeton-captcha" } });
  });
  it("explique un contrôle anti-robot refusé", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 400, code: "captcha_failed" } });
    await expect(envoyerLienConnexion("hakim@example.com", "http://localhost:3000", "/espace", "x")).rejects.toThrow("contrôle anti-robot");
  });
  it("n’envoie rien si l’adresse est invalide", async () => {
    await expect(envoyerLienConnexion("invalide", "http://localhost:3000")).rejects.toThrow("Saisissez une adresse e-mail valide.");
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
  it("traduit un échec Supabase en français", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "Rate limit exceeded" } });
    await expect(envoyerLienConnexion("hakim@example.com", "http://localhost:3000")).rejects.toThrow("Impossible d’envoyer le lien");
  });
  it("explique la limite d’envoi au lieu d’inviter à réessayer immédiatement", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    await expect(envoyerLienConnexion("hakim@example.com", "http://localhost:3000")).rejects.toThrow("La limite d’envoi des e-mails de connexion est atteinte.");
  });
});

describe("US-09 : destination suite", () => {
  it("utilise /espace si suite est absente", () => { expect(cheminSuite(null)).toBe("/espace"); });
  it.each(["/espace", "/espace/articles?statut=disponible", "/catalogue?q=polo#resultats", "/"])("accepte %s", suite => { expect(cheminSuite(suite)).toBe(suite); });
  it.each(["", "espace", "https://exemple.com", "//exemple.com", "/\\exemple.com", "/%5cexemple.com", "/%2fexemple.com", "/a/..//exemple.com", "/%0d%0aLocation:evil", "/%ZZ", " /espace"])("refuse %s", suite => { expect(cheminSuite(suite)).toBeNull(); });
});

describe("US-20.2 : connexion client", () => {
  it("renvoie le client vers le panier ou son compte, jamais ailleurs", () => {
    expect(cheminSuiteClient("/panier")).toBe("/panier");
    expect(cheminSuiteClient("/compte/commandes/11111111-1111-1111-1111-111111111111")).toBe("/compte/commandes/11111111-1111-1111-1111-111111111111");
    expect(cheminSuiteClient("/espace")).toBe("/compte/commandes");
    expect(cheminSuiteClient("//exemple.com/compte")).toBe("/compte/commandes");
    expect(cheminSuiteClient(undefined)).toBe("/compte/commandes");
    expect(pageConnexion("/panier")).toBe("/compte/connexion");
    expect(pageConnexion("/espace")).toBe("/espace/connexion");
  });
  it("envoie le lien avec la destination du client", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    await envoyerLienConnexion("client@example.com", "http://localhost:3000", "/panier");
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "client@example.com", options: { emailRedirectTo: "http://localhost:3000/auth/callback?suite=/panier" } });
    await envoyerLienConnexion("client@example.com", "http://localhost:3000", "https://pirate.example");
    expect(signInWithOtp).toHaveBeenLastCalledWith({ email: "client@example.com", options: { emailRedirectTo: "http://localhost:3000/auth/callback?suite=/espace" } });
  });
});
