import { creerClientNavigateur } from "./supabase/client";

export class ErreurConnexion extends Error {}

/** Validation commune au formulaire et à l’envoi du lien (remplaçable par SMS). */
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

/** Accepte uniquement une destination sur la même origine, jamais //hote. */
export function cheminSuite(suite: string | null | undefined): string | null {
  if (suite == null) return "/espace";
  try {
    const decode = decodeURIComponent(suite);
    if (!suite.startsWith("/") || suite.startsWith("//") || decode.startsWith("//")
      || /[\\\u0000-\u0020\u007f]/.test(suite) || /[\\\u0000-\u001f\u007f]/.test(decode)) return null;
    const url = new URL(suite, "https://oranpromo.invalid");
    if (url.origin !== "https://oranpromo.invalid" || url.pathname.startsWith("//")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
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

export async function envoyerLienConnexion(email: string, origine: string, suite = "/espace") {
  if (!emailValide(email)) throw new Error("Saisissez une adresse e-mail valide.");
  const destination = /^\/[a-zA-Z0-9/_-]*$/.test(suite) && !suite.startsWith("//") ? suite : "/espace";
  const { error } = await creerClientNavigateur().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${origine}/auth/callback?suite=${destination}` },
  });
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit" || error?.status === 429) {
    throw new ErreurConnexion("La limite d’envoi des e-mails de connexion est atteinte. Attendez avant de demander un nouveau lien.");
  }
  if (error) throw new ErreurConnexion("Impossible d’envoyer le lien de connexion. Réessayez dans quelques instants.");
}
