import { creerClientNavigateur } from "./supabase/client";

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

export async function envoyerLienConnexion(email: string, origine: string) {
  if (!emailValide(email)) throw new Error("Saisissez une adresse e-mail valide.");
  const { error } = await creerClientNavigateur().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${origine}/auth/callback?suite=/espace` },
  });
  if (error) throw new Error("Impossible d’envoyer le lien de connexion. Réessayez dans quelques instants.");
}
