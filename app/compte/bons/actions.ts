"use server";
import { creerClientServeur } from "@/lib/supabase/server";
import { ajouterCodeBon, normaliserCodeBon, type ReponseCode } from "@/lib/campagnes";

// US-33.3 : « J'ai un code » dans /compte. Les règles (code, dates, budget, une fois par numéro, 5 codes faux par
// heure) sont dans la base ; un code mal écrit ne part pas (il ne compte pas comme essai).
export async function ajouterCode(saisie: string): Promise<ReponseCode | { etat: "erreur" }> {
  const code = normaliserCodeBon(saisie);
  if (!code) return { etat: "inconnu" };
  try { return await ajouterCodeBon(await creerClientServeur(), code); }
  catch { return { etat: "erreur" }; }
}
