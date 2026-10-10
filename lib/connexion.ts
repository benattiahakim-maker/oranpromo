import { creerClientNavigateur } from "./supabase/client";
import { cheminSuite } from "./chemin";

// Suivi de la relecture n°6, point 4 : cheminSuite vit dans lib/chemin.ts (sans dépendance), réexporté ici.
export { cheminSuite };

export class ErreurConnexion extends Error {}

/** Validation commune au formulaire et à l’envoi du lien. */
export function emailValide(email: string): boolean {
  const adresse = email.trim();
  if (adresse.length > 254) return false;
  const parties = adresse.split("@");
  if (parties.length !== 2 || parties[0].length > 64) return false;
  const [local, domaine] = parties;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..")
    && domaine.split(".").length >= 2
    && domaine.split(".").every(partie => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(partie));
}

/** US-20.2 : après la connexion d’un client, retour au panier ou à une page de son compte uniquement. */
export function cheminSuiteClient(suite: string | null | undefined): string {
  const chemin = suite ? cheminSuite(suite) : null;
  return chemin && /^\/(panier|compte)(\/[a-zA-Z0-9_-]+)*\/?$/.test(chemin) ? chemin : "/compte/commandes";
}

/** Page de connexion à utiliser quand un lien échoue, selon la destination (client ou commerçant). */
export function pageConnexion(suite: string | null | undefined): string {
  return suite && /^\/(panier|compte)(\/|$)/.test(suite) ? "/compte/connexion" : "/espace/connexion";
}

/** captchaToken : jeton Cloudflare Turnstile, exigé par Supabase quand la protection anti-robot est activée (US-21). */
export async function envoyerLienConnexion(email: string, origine: string, suite = "/espace", captchaToken?: string | null) {
  if (!emailValide(email)) throw new Error("Saisissez une adresse e-mail valide.");
  const destination = /^\/[a-zA-Z0-9/_-]*$/.test(suite) && !suite.startsWith("//") ? suite : "/espace";
  const { error } = await creerClientNavigateur().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${origine}/auth/callback?suite=${destination}`, ...(captchaToken ? { captchaToken } : {}) },
  });
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit" || error?.status === 429) {
    throw new ErreurConnexion("La limite d’envoi des e-mails de connexion est atteinte. Attendez avant de demander un nouveau lien.");
  }
  if (error?.code === "captcha_failed") throw new ErreurConnexion("Le contrôle anti-robot a échoué ou a expiré : recommencez-le.");
  if (error) throw new ErreurConnexion("Impossible d’envoyer le lien de connexion. Réessayez dans quelques instants.");
}
