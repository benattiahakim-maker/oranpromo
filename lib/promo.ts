import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { articleDeMaBoutique, confirmerModification } from "./gestion-articles";
import { pourcentageReduction } from "./prix";

export type SaisiePromo = { prixPromo: string; dateFin: string; badge: "reduction" | "flash" };
export type ErreursPromo = Partial<Record<"prixPromo" | "dateFin" | "badge", string>>;

export function prixDepuisPourcentage(prix: number, pourcentage: string): number | null {
  if (!/^\d+(?:[.,]\d+)?$/.test(pourcentage.trim())) return null;
  const reduction = Number(pourcentage.trim().replace(",", "."));
  if (!Number.isInteger(prix) || prix <= 0 || reduction <= 0 || reduction >= 100) return null;
  return Math.round(prix * (1 - reduction / 100));
}

export function pourcentageDepuisPrix(prix: number, prixPromo: string): number | null {
  if (!/^\d+$/.test(prixPromo.trim()) || prix <= 0 || !Number.isInteger(prix)) return null;
  const montant = Number(prixPromo);
  if (!Number.isSafeInteger(montant) || montant <= 0 || montant >= prix) return null;
  return pourcentageReduction(prix, montant);
}

export function dateFinPromo(valeur: string): Date | null {
  const parties = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valeur);
  if (!parties) return null;
  const date = new Date(valeur);
  const [, annee, mois, jour, heures, minutes] = parties.map(Number);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== annee || date.getMonth() + 1 !== mois || date.getDate() !== jour || date.getHours() !== heures || date.getMinutes() !== minutes) return null;
  return date;
}

export function datePourChampPromo(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const deux = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}T${deux(date.getHours())}:${deux(date.getMinutes())}`;
}

export function validerPromo(prixNormal: number, saisie: SaisiePromo, maintenant = new Date()): ErreursPromo {
  const erreurs: ErreursPromo = {};
  const prix = Number(saisie.prixPromo.trim());
  if (!/^\d+$/.test(saisie.prixPromo.trim()) || !Number.isSafeInteger(prix) || prix <= 0) erreurs.prixPromo = "Saisissez un prix promo entier en DA, supérieur à 0.";
  else if (prix >= prixNormal) erreurs.prixPromo = "Le prix promo doit être inférieur au prix normal.";
  const date = dateFinPromo(saisie.dateFin);
  if (!saisie.dateFin) erreurs.dateFin = "Choisissez une date de fin.";
  else if (!date) erreurs.dateFin = "Saisissez une date de fin valide.";
  else if (date <= maintenant) erreurs.dateFin = "La date de fin doit être dans le futur.";
  if (!["reduction", "flash"].includes(saisie.badge)) erreurs.badge = "Choisissez un badge.";
  return erreurs;
}

async function confirmerArticle(client: SupabaseClient<Database>, id: string, boutiqueId: string) {
  const { data, error } = await client.from("articles").update(confirmerModification({})).eq("id", id).eq("boutique_id", boutiqueId).select("id").single();
  if (error || !data) throw new Error("Impossible de confirmer l’article. La promo n’a pas été modifiée.");
}

export async function enregistrerPromo(client: SupabaseClient<Database>, id: string, saisie: SaisiePromo) {
  const article = await articleDeMaBoutique(client, id);
  // Revalider avec le prix réel en base, jamais avec un prix fourni par le navigateur.
  const erreurs = validerPromo(article.prix, saisie);
  if (Object.keys(erreurs).length) throw new Error(Object.values(erreurs).join(" "));
  await confirmerArticle(client, id, article.boutique_id);
  const { error } = await client.from("promos").upsert({ article_id: id, prix_promo: Number(saisie.prixPromo), date_fin: dateFinPromo(saisie.dateFin)!.toISOString(), badge: saisie.badge === "flash" ? "Promo flash" : null }, { onConflict: "article_id" });
  if (error) throw new Error("Impossible d’enregistrer la promo. Réessayez.");
}

export async function arreterPromo(client: SupabaseClient<Database>, id: string) {
  const article = await articleDeMaBoutique(client, id);
  await confirmerArticle(client, id, article.boutique_id);
  const { error } = await client.from("promos").delete().eq("article_id", id);
  if (error) throw new Error("Impossible d’arrêter la promo. Réessayez.");
}
