// US-33.2 : nom et lignes d'un bon (parrainage, bienvenue, campagne) pour « Mes bons » et le panier.
import { remplir, type Langue } from "./langue";
import { formaterPrix } from "./prix";
import { estBonProgramme, formaterJourMoisNumerique, minimumBon, type BonClient, type RaisonBonPanier } from "./bons";
import type { fr } from "./textes/fr";

type TextesBons = typeof fr.parrainage;

/** « Bon parrainage », « Bon de bienvenue », « Bon Aïd 2026 » (nom du programme dans la langue de la page). */
export function nomDuBon(bon: Pick<BonClient, "origine" | "nom_fr" | "nom_ar">, t: TextesBons, langue: Langue): string {
  // US-31.4 : le bon de l'inscription en boutique est un bon de bienvenue.
  if (bon.origine === "bienvenue" || bon.origine === "inscription_boutique") return t.nomBienvenue;
  // US-32.5 : bon « avis » nommé comme une campagne, par son programme (« Bon Avis », « بون راي »).
  if (bon.origine === "campagne" || bon.origine === "avis") return remplir(t.nomProgramme, { nom: (langue === "ar" ? bon.nom_ar : bon.nom_fr) ?? bon.nom_fr ?? "" });
  return t.nomBon;
}

/** « 300 DA dès 2 000 DA d'achat · jusqu'au 9/11 » : bon de programme disponible (null pour le parrainage). */
export function detailBonProgramme(bon: BonClient, t: TextesBons, langue: Langue): string | null {
  if (!estBonProgramme(bon) || bon.statut !== "disponible" || !bon.expire_le) return null;
  return remplir(t.detailProgramme, { montant: formaterPrix(bon.montant, langue), minimum: formaterPrix(minimumBon(bon), langue), date: formaterJourMoisNumerique(bon.expire_le) });
}

/** US-31.4 : « Chez Boutique Nour : dès le 11/10. Ailleurs : tout de suite. » tant que le bon d'inscription n'est pas
 *  utilisable dans la boutique d'origine (null sinon). */
export function detailInscription(bon: BonClient, t: TextesBons, maintenant: Date = new Date()): string | null {
  if (bon.origine !== "inscription_boutique" || bon.statut !== "disponible" || !bon.utilisable_des || !bon.boutique_origine) return null;
  if (new Date(bon.utilisable_des).getTime() <= maintenant.getTime()) return null;
  return remplir(t.detailInscription, { boutique: bon.boutique_origine, date: formaterJourMoisNumerique(bon.utilisable_des) });
}

/** Libellé de la case du panier. */
export function libelleUtiliserBon(bon: BonClient, t: TextesBons, langue: Langue): string {
  if (bon.origine === "bienvenue" || bon.origine === "inscription_boutique") return remplir(t.utiliserBonBienvenue, { montant: formaterPrix(bon.montant, langue) });
  if (bon.origine === "campagne" || bon.origine === "avis") return remplir(t.utiliserBonProgramme, { nom: (langue === "ar" ? bon.nom_ar : bon.nom_fr) ?? bon.nom_fr ?? "", montant: formaterPrix(bon.montant, langue) });
  return remplir(t.utiliserBon, { montant: formaterPrix(bon.montant, langue) });
}

/** Phrase d'aide de « Mes bons », bon par bon (bons encore utilisables) : nom, montant réel et qui paie.
 *  Bon de l'inscription en boutique (US-31.4) : BleDeal et la boutique d'origine ; tous les autres : BleDeal.
 *  Bons identiques (même nom, montant, payeur) une seule fois, du plus petit au plus grand. null : aucun bon, pas de phrase. */
export function aideMesBons(bons: Pick<BonClient, "origine" | "montant" | "nom_fr" | "nom_ar">[], t: TextesBons, langue: Langue): string | null {
  const phrases = [...bons].filter(b => b.montant > 0).sort((x, y) => x.montant - y.montant)
    .map(b => remplir(b.origine === "inscription_boutique" ? t.aideBonInscription : t.aideBonBleDeal, { nom: nomDuBon(b, t, langue), montant: formaterPrix(b.montant, langue) }));
  const uniques = [...new Set(phrases)];
  return uniques.length ? [t.aideBons, ...uniques].join(" ") : null;
}

/** US-33.3 : raison affichée au panier quand un bon ne s'applique pas (textes n° 10 à 13). */
export function texteRaisonBon(bon: BonClient, raison: RaisonBonPanier, t: TextesBons, langue: Langue): string | null {
  switch (raison) {
    case "minimum": return remplir(t.minimumProgramme, { minimum: formaterPrix(minimumBon(bon), langue) });
    case "univers": return bon.univers && bon.univers in t.universBon ? remplir(t.raisonUnivers, { univers: t.universBon[bon.univers as keyof TextesBons["universBon"]] }) : null;
    case "ville": return t.raisonVille;
    case "plafond_boutique": return t.raisonPlafond;
    case "boutique_exclue": return t.raisonBoutique;
    case "pas_aujourdhui": return t.raisonPasAujourdhui;
    default: return null;
  }
}
