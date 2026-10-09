import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { envoyerCodeConnexionClient, envoyerCodeVerificationClient, MESSAGE_CODE_INCORRECT, MESSAGE_RESERVE_CLIENTS, MESSAGE_NON_ACTIVEE, MESSAGE_NON_CONFIGUREE, messageErreurAuth, verifierCodeConnexionClient, verifierCodeVerificationClient } from "./codes-telephone";

const rpc = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const updateUser = vi.fn();
const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const client = { rpc, from, auth: { signInWithOtp, verifyOtp, updateUser, getUser } } as unknown as SupabaseClient<Database>;
const JETON = "secret-serveur-0123456789";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONNEXION_CLIENT", "telephone");
  vi.stubEnv("CRON_SECRET", JETON);
  rpc.mockResolvedValue({ error: null });
  signInWithOtp.mockResolvedValue({ data: {}, error: null });
  verifyOtp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
  updateUser.mockResolvedValue({ data: {}, error: null });
  getUser.mockResolvedValue({ data: { user: { id: "u1", phone: "", phone_confirmed_at: null } }, error: null });
  maybeSingle.mockResolvedValue({ data: { role: "client" }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("envoi du code de connexion (US-21.2)", () => {
  it("contrôle les limites, envoie sur WhatsApp avec le captcha, puis enregistre l’envoi", async () => {
    await expect(envoyerCodeConnexionClient(client, "0555 12 34 56", "jeton-captcha")).resolves.toEqual({ numero: "+213555123456" });
    expect(rpc).toHaveBeenNthCalledWith(1, "controler_envoi_code", { jeton: JETON, numero: "+213555123456" });
    expect(signInWithOtp).toHaveBeenCalledWith({ phone: "+213555123456", options: { channel: "whatsapp", captchaToken: "jeton-captcha" } });
    expect(rpc).toHaveBeenNthCalledWith(2, "enregistrer_envoi_code", { jeton: JETON, numero: "+213555123456" });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(signInWithOtp.mock.invocationCallOrder[0]);
    expect(signInWithOtp.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[1]);
  });
  it("toujours WhatsApp, jamais SMS ; sans captcha, pas de captchaToken", async () => {
    await envoyerCodeConnexionClient(client, "+213 661 23 45 67", null);
    expect(signInWithOtp).toHaveBeenLastCalledWith({ phone: "+213661234567", options: { channel: "whatsapp" } });
    await envoyerCodeConnexionClient(client, "0661234567", "");
    expect(signInWithOtp).toHaveBeenLastCalledWith({ phone: "+213661234567", options: { channel: "whatsapp" } });
    // Un appel qui tenterait encore de passer « sms » (ancienne signature) ne change pas le canal.
    const ancien = envoyerCodeConnexionClient as unknown as (c: typeof client, t: string, canal: string, j: string) => Promise<unknown>;
    await ancien(client, "0661234567", "sms", "j");
    expect(signInWithOtp).toHaveBeenLastCalledWith({ phone: "+213661234567", options: { channel: "whatsapp", captchaToken: "sms" } });
    expect(JSON.stringify(signInWithOtp.mock.calls)).not.toContain('"channel":"sms"');
  });
  it("refuse un numéro non algérien sans rien appeler", async () => {
    await expect(envoyerCodeConnexionClient(client, "+33612345678", "j")).rejects.toThrow("mobile algérien");
    await expect(envoyerCodeConnexionClient(client, "0412345678", "j")).rejects.toThrow("mobile algérien");
    await expect(envoyerCodeConnexionClient(client, 42, "j")).rejects.toThrow("mobile algérien");
    expect(rpc).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
  it("refuse en mode e-mail (par défaut)", async () => {
    vi.stubEnv("CONNEXION_CLIENT", "");
    await expect(envoyerCodeConnexionClient(client, "0555123456", "j")).rejects.toThrow(MESSAGE_NON_ACTIVEE);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
  it("refuse sans jeton serveur (CRON_SECRET) : limites impossibles à vérifier", async () => {
    vi.stubEnv("CRON_SECRET", "");
    await expect(envoyerCodeConnexionClient(client, "0555123456", "j")).rejects.toThrow(MESSAGE_NON_CONFIGUREE);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
  it("relaie la limite par numéro de la base et n’envoie rien", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "54000", message: "Attendez une minute avant de demander un nouveau code." } });
    await expect(envoyerCodeConnexionClient(client, "0555123456", "j")).rejects.toThrow("Attendez une minute");
    expect(signInWithOtp).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ error: { code: "42501", message: "Accès refusé." } });
    await expect(envoyerCodeConnexionClient(client, "0555123456", "j")).rejects.toThrow(MESSAGE_NON_CONFIGUREE);
    rpc.mockResolvedValueOnce({ error: { code: "XX000", message: "boom" } });
    await expect(envoyerCodeConnexionClient(client, "0555123456", "j")).rejects.toThrow("Impossible d’envoyer le code");
  });
  it("captcha refusé : message clair, l’envoi n’est pas compté", async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: { code: "captcha_failed", status: 400 } });
    await expect(envoyerCodeConnexionClient(client, "0555123456", "j")).rejects.toThrow("contrôle anti-robot");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("un échec d’enregistrement n’empêche pas le client de recevoir son code", async () => {
    rpc.mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error("réseau"));
    await expect(envoyerCodeConnexionClient(client, "0555123456", "j")).resolves.toEqual({ numero: "+213555123456" });
  });
});

describe("vérification du code de connexion", () => {
  it("vérifie avec le type « sms » de Supabase (code reçu sur WhatsApp)", async () => {
    await verifierCodeConnexionClient(client, "0555123456", " 123 456 ");
    expect(verifyOtp).toHaveBeenCalledWith({ phone: "+213555123456", token: "123456", type: "sms" });
  });
  it("code mal saisi : rien n’est envoyé à Supabase", async () => {
    await expect(verifierCodeConnexionClient(client, "0555123456", "12345")).rejects.toThrow("6 chiffres");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
  it("code faux ou expiré", async () => {
    verifyOtp.mockResolvedValue({ data: { session: null }, error: { code: "otp_expired", status: 403 } });
    await expect(verifierCodeConnexionClient(client, "0555123456", "123456")).rejects.toThrow(MESSAGE_CODE_INCORRECT);
    verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
    await expect(verifierCodeConnexionClient(client, "0555123456", "123456")).rejects.toThrow(MESSAGE_CODE_INCORRECT);
  });
  it("refuse en mode e-mail", async () => {
    vi.stubEnv("CONNEXION_CLIENT", "email");
    await expect(verifierCodeConnexionClient(client, "0555123456", "123456")).rejects.toThrow(MESSAGE_NON_ACTIVEE);
  });
});

describe("vérification du numéro d’un compte connecté", () => {
  it("relecture n°4 : un compte admin, commerçant ou ambassadeur ne peut pas ajouter de numéro (rien n’est envoyé)", async () => {
    for (const role of ["admin", "commercant", "ambassadeur"]) {
      maybeSingle.mockResolvedValueOnce({ data: { role }, error: null });
      await expect(envoyerCodeVerificationClient(client, "0798765432")).rejects.toThrow(MESSAGE_RESERVE_CLIENTS);
    }
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(envoyerCodeVerificationClient(client, "0798765432")).rejects.toThrow(MESSAGE_RESERVE_CLIENTS);
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "réseau" } });
    await expect(envoyerCodeVerificationClient(client, "0798765432")).rejects.toThrow("Impossible d’envoyer");
    expect(from).toHaveBeenCalledWith("profils");
    expect(eq).toHaveBeenCalledWith("id", "u1");
    expect(updateUser).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("demande le changement de numéro sur WhatsApp, sans captcha, et compte l’envoi", async () => {
    await expect(envoyerCodeVerificationClient(client, "0798765432")).resolves.toEqual({ numero: "+213798765432" });
    expect(updateUser).toHaveBeenCalledWith({ phone: "+213798765432", channel: "whatsapp" });
    expect(rpc).toHaveBeenCalledWith("controler_envoi_code", { jeton: JETON, numero: "+213798765432" });
    expect(rpc).toHaveBeenCalledWith("enregistrer_envoi_code", { jeton: JETON, numero: "+213798765432" });
  });
  it("numéro déjà pris par un autre compte", async () => {
    updateUser.mockResolvedValue({ data: {}, error: { code: "phone_exists", status: 422 } });
    await expect(envoyerCodeVerificationClient(client, "0798765432")).rejects.toThrow("déjà utilisé par un autre compte");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("numéro déjà vérifié sur ce compte, ou session expirée", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1", phone: "213798765432", phone_confirmed_at: "2026-10-09T10:00:00Z" } }, error: null });
    await expect(envoyerCodeVerificationClient(client, "0798765432")).rejects.toThrow("déjà vérifié");
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(envoyerCodeVerificationClient(client, "0798765432")).rejects.toThrow("session a expiré");
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("vérifie le code avec le type « phone_change »", async () => {
    await verifierCodeVerificationClient(client, "0798765432", "654321");
    expect(verifyOtp).toHaveBeenCalledWith({ phone: "+213798765432", token: "654321", type: "phone_change" });
    verifyOtp.mockResolvedValue({ data: {}, error: { code: "otp_expired", status: 403 } });
    await expect(verifierCodeVerificationClient(client, "0798765432", "654321")).rejects.toThrow(MESSAGE_CODE_INCORRECT);
  });
});

describe("messageErreurAuth", () => {
  it.each([
    [{ code: "over_sms_send_rate_limit", status: 429 }, "envoi", "Trop de demandes"],
    [{ status: 429 }, "envoi", "Trop de demandes"],
    [{ code: "sms_send_failed", status: 500 }, "envoi", "utilise WhatsApp"],
    [{ code: "phone_provider_disabled", status: 400 }, "envoi", "pas encore configurée"],
    [{ code: "validation_failed", status: 400 }, "envoi", "mobile algérien"],
    [{ status: 500 }, "envoi", "Impossible d’envoyer le code"],
    [{ code: "invalid_credentials", status: 400 }, "verification", "Code incorrect"],
    [{ status: 500 }, "verification", "Impossible de vérifier le code"],
  ] as const)("%j (%s)", (erreur, etape, attendu) => {
    expect(messageErreurAuth(erreur, etape)).toContain(attendu);
  });
});
