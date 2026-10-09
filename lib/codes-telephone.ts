import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { CANAL_CODE, MESSAGE_TELEPHONE_INVALIDE, modeConnexionClient, nettoyerCode, normaliserTelephoneClient } from "./telephone";

// US-21.2 : envoi et vérification des codes par Supabase Auth (fournisseur Twilio Verify, configuré dans le
// tableau de bord Supabase : aucune clé ici). Limites par numéro dans la base (controler_envoi_code /
// enregistrer_envoi_code, jeton = CRON_SECRET). Voir docs/architecture.md, « Connexion des clients par téléphone ».

type Client = SupabaseClient<Database>;
type ErreurAuth = { code?: string; status?: number; message?: string } | null | undefined;

export class ErreurCode extends Error {}

export const MESSAGE_NON_ACTIVEE = "La connexion par téléphone n’est pas encore activée. Connectez-vous avec votre e-mail.";
export const MESSAGE_NON_CONFIGUREE = "La connexion par téléphone n’est pas encore configurée. Réessayez plus tard ou connectez-vous avec votre e-mail.";
export const MESSAGE_CODE_ENVOYE = "Code envoyé sur WhatsApp. Pas reçu ? Vérifiez le numéro, puis demandez un nouveau code dans une minute.";
export const MESSAGE_RESERVE_CLIENTS = "Les comptes commerçant, ambassadeur et administrateur se connectent par e-mail : pas de numéro de téléphone de connexion.";
export const MESSAGE_CODE_INCORRECT = "Code incorrect ou expiré. Vérifiez les 6 chiffres ou demandez un nouveau code.";

/** Erreur Supabase Auth → message en français pour le client. */
export function messageErreurAuth(erreur: ErreurAuth, etape: "envoi" | "verification"): string {
  const code = erreur?.code ?? "";
  if (code === "captcha_failed") return "Le contrôle anti-robot a échoué ou a expiré : recommencez-le, puis redemandez le code.";
  if (code === "phone_exists") return "Ce numéro est déjà utilisé par un autre compte : connectez-vous avec ce numéro.";
  if (code === "phone_provider_disabled") return MESSAGE_NON_CONFIGUREE;
  if (code === "over_sms_send_rate_limit" || code === "over_request_rate_limit" || erreur?.status === 429) return "Trop de demandes : attendez quelques minutes avant de redemander un code.";
  if (code === "sms_send_failed") return "Impossible d’envoyer le code sur WhatsApp. Vérifiez que ce numéro utilise WhatsApp, ou réessayez dans quelques minutes.";
  if (code === "validation_failed" || code === "bad_json") return MESSAGE_TELEPHONE_INVALIDE;
  if (etape === "verification" && (code === "otp_expired" || code === "invalid_credentials" || erreur?.status === 400 || erreur?.status === 403)) return MESSAGE_CODE_INCORRECT;
  return etape === "envoi" ? "Impossible d’envoyer le code. Réessayez dans quelques instants." : "Impossible de vérifier le code. Réessayez dans quelques instants.";
}

function verifierMode() {
  if (modeConnexionClient() !== "telephone") throw new ErreurCode(MESSAGE_NON_ACTIVEE);
}

function lireNumero(saisie: unknown): string {
  const numero = typeof saisie === "string" ? normaliserTelephoneClient(saisie) : null;
  if (!numero) throw new ErreurCode(MESSAGE_TELEPHONE_INVALIDE);
  return numero;
}

function jetonServeur(): string {
  const jeton = process.env.CRON_SECRET;
  if (!jeton || jeton.length < 16) throw new ErreurCode(MESSAGE_NON_CONFIGUREE);
  return jeton;
}

/** Limites par numéro (1 par minute, 5 par heure) vérifiées par la base avant l'envoi. */
async function controlerEnvoi(client: Client, numero: string, jeton: string) {
  const { error } = await client.rpc("controler_envoi_code", { jeton, numero });
  if (!error) return;
  if ((error.code === "54000" || error.code === "22023") && error.message) throw new ErreurCode(error.message);
  if (error.code === "42501") throw new ErreurCode(MESSAGE_NON_CONFIGUREE);
  throw new ErreurCode("Impossible d’envoyer le code. Réessayez dans quelques instants.");
}

/** Enregistre un envoi accepté ; un échec d'enregistrement n'annule pas le code déjà parti. */
async function enregistrerEnvoi(client: Client, numero: string, jeton: string) {
  try { await client.rpc("enregistrer_envoi_code", { jeton, numero }); } catch { /* le code est parti : on ne bloque pas le client */ }
}

export type EnvoiCode = { numero: string };

/** Connexion (ou création de compte) par numéro : captcha Turnstile obligatoire côté Supabase. */
export async function envoyerCodeConnexionClient(client: Client, saisie: unknown, jetonCaptcha: unknown): Promise<EnvoiCode> {
  verifierMode();
  const numero = lireNumero(saisie);
  const jeton = jetonServeur();
  await controlerEnvoi(client, numero, jeton);
  const captchaToken = typeof jetonCaptcha === "string" && jetonCaptcha.length > 0 && jetonCaptcha.length <= 4096 ? jetonCaptcha : undefined;
  const { error } = await client.auth.signInWithOtp({ phone: numero, options: { channel: CANAL_CODE, ...(captchaToken ? { captchaToken } : {}) } });
  if (error) throw new ErreurCode(messageErreurAuth(error, "envoi"));
  await enregistrerEnvoi(client, numero, jeton);
  return { numero };
}

/** Code reçu sur WhatsApp → session du client (Supabase nomme ce type « sms » quel que soit le canal). */
export async function verifierCodeConnexionClient(client: Client, saisie: unknown, saisieCode: unknown) {
  verifierMode();
  const numero = lireNumero(saisie);
  const token = nettoyerCode(typeof saisieCode === "string" ? saisieCode : null);
  if (!token) throw new ErreurCode("Saisissez les 6 chiffres du code reçu.");
  const { data, error } = await client.auth.verifyOtp({ phone: numero, token, type: "sms" });
  if (error || !data?.session) throw new ErreurCode(messageErreurAuth(error ?? { status: 400 }, "verification"));
}

/** Client déjà connecté (compte e-mail, ou changement de numéro) : code envoyé au nouveau numéro. */
export async function envoyerCodeVerificationClient(client: Client, saisie: unknown): Promise<EnvoiCode> {
  verifierMode();
  const numero = lireNumero(saisie);
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) throw new ErreurCode("Votre session a expiré. Reconnectez-vous.");
  if (user.phone && `+${user.phone}` === numero && user.phone_confirmed_at) throw new ErreurCode("Ce numéro est déjà vérifié sur votre compte.");
  // Relecture n°4 : seuls les clients ont un numéro de connexion (règle aussi dans la base, numero_client_algerien).
  const { data: profil, error: erreurProfil } = await client.from("profils").select("role").eq("id", user.id).maybeSingle();
  if (erreurProfil) throw new ErreurCode("Impossible d’envoyer le code. Réessayez dans quelques instants.");
  if (!profil || profil.role !== "client") throw new ErreurCode(MESSAGE_RESERVE_CLIENTS);
  const jeton = jetonServeur();
  await controlerEnvoi(client, numero, jeton);
  // Supabase Auth accepte « channel » sur PUT /user ; supabase-js transmet les attributs tels quels.
  const attributs = { phone: numero, channel: CANAL_CODE } as Parameters<Client["auth"]["updateUser"]>[0];
  const { error } = await client.auth.updateUser(attributs);
  if (error) throw new ErreurCode(messageErreurAuth(error, "envoi"));
  await enregistrerEnvoi(client, numero, jeton);
  return { numero };
}

export async function verifierCodeVerificationClient(client: Client, saisie: unknown, saisieCode: unknown) {
  verifierMode();
  const numero = lireNumero(saisie);
  const token = nettoyerCode(typeof saisieCode === "string" ? saisieCode : null);
  if (!token) throw new ErreurCode("Saisissez les 6 chiffres du code reçu.");
  const { error } = await client.auth.verifyOtp({ phone: numero, token, type: "phone_change" });
  if (error) throw new ErreurCode(messageErreurAuth(error, "verification"));
}
