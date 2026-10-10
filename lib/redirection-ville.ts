// US-29.2 : anciennes adresses sans ville (/, /catalogue?…, /carte?…) → même page dans la ville gardée.
import "server-only";
import { redirect } from "next/navigation";
import { getVilleParDefaut } from "@/lib/ville-serveur";
import { cheminVille } from "@/lib/ville";

/** Paramètres de l'adresse gardés tels quels (« ?promo=1&q=robe »). */
export function chaineRecherche(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [nom, valeur] of Object.entries(params)) {
    if (typeof valeur === "string") query.append(nom, valeur);
    else if (Array.isArray(valeur)) valeur.forEach(v => query.append(nom, v));
  }
  const texte = query.toString();
  return texte ? `?${texte}` : "";
}

/** Redirection temporaire (307) : ville du cookie si elle est ouverte, sinon la seule ville ouverte, sinon /villes. */
export async function redirigerVersVille(page: "" | "/catalogue" | "/carte", params: Record<string, string | string[] | undefined>): Promise<never> {
  const code = await getVilleParDefaut();
  const suite = `${page}${chaineRecherche(params)}`;
  if (code) redirect(cheminVille(code, suite));
  redirect(`/villes?${new URLSearchParams({ retour: suite.startsWith("?") ? `/${suite}` : suite || "/" })}`);
}
