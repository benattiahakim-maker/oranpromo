// Adresse réellement utilisée par le navigateur (ex. http://127.0.0.1:3000 ou https://oranpromo.com).
// request.url peut indiquer « localhost » en développement : rediriger vers une autre adresse
// ferait perdre les cookies de session, qui sont liés à l'adresse exacte.
export function origineRequete(request: Request): string {
  const url = new URL(request.url);
  const hote = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
  if (!hote || !/^[a-zA-Z0-9.-]+(:\d+)?$|^\[[0-9a-fA-F:]+\](:\d+)?$/.test(hote)) return url.origin;
  const protocole = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.replace(":", "");
  return `${protocole === "https" ? "https" : "http"}://${hote}`;
}
