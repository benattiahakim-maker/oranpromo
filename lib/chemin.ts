// Suivi de la relecture n°6, point 4 : contrôle des chemins de retour, sans aucune dépendance (ni Supabase, ni Next.js),
// pour que les composants du navigateur qui l'utilisent (lib/ville.ts) n'embarquent pas le client Supabase.
// Utilisé par lib/connexion.ts (connexion, retour après le lien magique) et lib/ville.ts (/villes?retour=).

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
