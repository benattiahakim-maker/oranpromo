// US-23 : langue de la requête en cours (cookie « langue »), côté serveur uniquement.
import "server-only";
import { cookies } from "next/headers";
import { COOKIE_LANGUE, langueDepuisCookie, type Langue } from "@/lib/langue";
import { textesDe, type Textes } from "@/lib/textes";
import { traduireErreurs, traduireMessage } from "@/lib/textes/messages";

export async function getLangue(): Promise<Langue> {
  return langueDepuisCookie((await cookies()).get(COOKIE_LANGUE)?.value);
}

export async function getTextes(): Promise<Textes> {
  return textesDe(await getLangue());
}

type ResultatAvecMessages = { message?: string; erreur?: string; erreurs?: Record<string, string | undefined> };
/** Résultat d'une action serveur, ses messages traduits dans la langue du visiteur (le français reste tel quel). */
export async function enLangue<T extends ResultatAvecMessages>(resultat: T): Promise<T> {
  const langue = await getLangue();
  if (langue === "fr") return resultat;
  return {
    ...resultat,
    ...(resultat.message !== undefined ? { message: traduireMessage(resultat.message, langue) } : {}),
    ...(resultat.erreur !== undefined ? { erreur: traduireMessage(resultat.erreur, langue) } : {}),
    ...(resultat.erreurs ? { erreurs: traduireErreurs(resultat.erreurs, langue) } : {}),
  };
}
