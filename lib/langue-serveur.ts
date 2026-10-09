// US-23 : langue de la requête en cours (cookie « langue »), côté serveur uniquement.
import "server-only";
import { cookies } from "next/headers";
import { COOKIE_LANGUE, langueDepuisCookie, type Langue } from "@/lib/langue";
import { textesDe, type Textes } from "@/lib/textes";

export async function getLangue(): Promise<Langue> {
  return langueDepuisCookie((await cookies()).get(COOKIE_LANGUE)?.value);
}

export async function getTextes(): Promise<Textes> {
  return textesDe(await getLangue());
}
