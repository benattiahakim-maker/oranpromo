// US-29.2 : villes ouvertes (une seule lecture par requête) et ville gardée dans le cookie, côté serveur uniquement.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { creerClientServeur } from "@/lib/supabase/server";
import { COOKIE_VILLE, VILLE_ORAN, villeParDefaut, type Ville } from "@/lib/ville";

/** Villes ouvertes, triées (ordre, nom). Base illisible : Oran seule, pour que le site d'Oran reste identique. */
export const getVillesOuvertes = cache(async (): Promise<Ville[]> => {
  try {
    const client = await creerClientServeur();
    const { data, error } = await client.rpc("villes_ouvertes");
    if (error || !data) return [VILLE_ORAN];
    return data as Ville[];
  } catch {
    return [VILLE_ORAN];
  }
});

/** La ville ouverte de ce code, ou null (inconnue ou fermée). */
export async function getVilleOuverte(code: string): Promise<Ville | null> {
  return (await getVillesOuvertes()).find(v => v.code === code) ?? null;
}

/** Ville gardée par le client (cookie), telle quelle (peut être fermée ou inconnue). */
export async function getCookieVille(): Promise<string | null> {
  return (await cookies()).get(COOKIE_VILLE)?.value ?? null;
}

/** Ville à ouvrir sans ville dans l'adresse (null : page de choix). */
export async function getVilleParDefaut(): Promise<string | null> {
  const [cookie, ouvertes] = await Promise.all([getCookieVille(), getVillesOuvertes()]);
  return villeParDefaut(cookie, ouvertes);
}
