// Adresse réellement utilisée par le navigateur (ex. http://127.0.0.1:3000 ou https://oranpromo.com).
// request.url peut indiquer « localhost » en développement : rediriger vers une autre adresse
// ferait perdre les cookies de session, qui sont liés à l'adresse exacte.
// Les en-têtes Host / X-Forwarded-Host viennent du client : seuls les hôtes connus sont acceptés
// (celui de NEXT_PUBLIC_SITE_URL, plus localhost / 127.0.0.1 en développement), sinon on ne
// pourrait pas exclure une redirection vers un domaine choisi par un attaquant.
export type OptionsOrigine = { siteUrl?: string; production?: boolean };

const HOTES_LOCAUX = ["localhost", "127.0.0.1", "[::1]"];

function urlSite(siteUrl?: string): URL | null {
  try { const url = siteUrl ? new URL(siteUrl) : null; return url && ["http:", "https:"].includes(url.protocol) ? url : null; } catch { return null; }
}

export function hoteAutorise(hote: string, options: OptionsOrigine = {}): boolean {
  const site = urlSite(options.siteUrl);
  const nom = hote.toLowerCase().replace(/:\d+$/, "");
  if (site && hote.toLowerCase() === site.host.toLowerCase()) return true;
  // Hôtes locaux : en développement, ou quand le site lui-même est configuré en local (npm start sur le PC).
  const siteLocal = site !== null && HOTES_LOCAUX.includes(site.hostname.toLowerCase());
  return (!options.production || siteLocal) && HOTES_LOCAUX.includes(nom);
}

export function origineRequete(request: Request, options: OptionsOrigine = { siteUrl: process.env.NEXT_PUBLIC_SITE_URL, production: process.env.NODE_ENV === "production" }): string {
  const url = new URL(request.url);
  const site = urlSite(options.siteUrl);
  const repli = site?.origin ?? url.origin;
  const hote = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
  if (!hote || !/^[a-zA-Z0-9.-]+(:\d+)?$|^\[[0-9a-fA-F:]+\](:\d+)?$/.test(hote) || !hoteAutorise(hote, options)) return repli;
  if (site && hote.toLowerCase() === site.host.toLowerCase()) return site.origin;
  const protocole = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  return `${protocole === "https" ? "https" : "http"}://${hote}`;
}
