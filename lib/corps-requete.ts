// Lecture bornée du corps d'une requête : on n'accepte jamais plus de `maximum` octets en mémoire,
// que l'en-tête Content-Length soit présent, absent (envoi « chunked ») ou mensonger.
export class CorpsTropGros extends Error {
  constructor() { super("Corps de requête trop volumineux."); this.name = "CorpsTropGros"; }
}

export async function lireCorpsLimite(request: Request, maximum: number): Promise<Uint8Array> {
  const annonce = request.headers.get("content-length");
  if (annonce !== null && (!/^\d+$/.test(annonce.trim()) || Number(annonce) > maximum)) throw new CorpsTropGros();
  if (!request.body) return new Uint8Array();
  const lecteur = request.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) { await lecteur.cancel().catch(() => {}); throw new CorpsTropGros(); }
    morceaux.push(value);
  }
  const corps = new Uint8Array(total);
  let position = 0;
  for (const morceau of morceaux) { corps.set(morceau, position); position += morceau.byteLength; }
  return corps;
}

// Lit un formulaire multipart en bornant sa taille avant l'analyse.
export async function lireFormulaireLimite(request: Request, maximum: number): Promise<FormData> {
  const corps = await lireCorpsLimite(request, maximum);
  return new Response(corps as BodyInit, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
}
