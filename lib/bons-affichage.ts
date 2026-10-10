// US-33.2 : nom et lignes d'un bon (parrainage, bienvenue, campagne) pour « Mes bons » et le panier.
import { remplir, type Langue } from "./langue";
import { formaterPrix } from "./prix";
import { estBonProgramme, formaterJourMoisNumerique, minimumBon, type BonClient } from "./bons";
import type { fr } from "./textes/fr";

type TextesBons = typeof fr.parrainage;

/** « Bon parrainage », « Bon de bienvenue », « Bon Aïd 2026 » (nom du programme dans la langue de la page). */
export function nomDuBon(bon: BonClient, t: TextesBons, langue: Langue): string {
  if (bon.origine === "bienvenue") return t.nomBienvenue;
  if (bon.origine === "campagne") return remplir(t.nomProgramme, { nom: (langue === "ar" ? bon.nom_ar : bon.nom_fr) ?? bon.nom_fr ?? "" });
  return t.nomBon;
}

/** « 300 DA dès 2 000 DA d'achat · jusqu'au 9/11 » : bon de programme disponible (null pour le parrainage). */
export function detailBonProgramme(bon: BonClient, t: TextesBons, langue: Langue): string | null {
  if (!estBonProgramme(bon) || bon.statut !== "disponible" || !bon.expire_le) return null;
  return remplir(t.detailProgramme, { montant: formaterPrix(bon.montant, langue), minimum: formaterPrix(minimumBon(bon), langue), date: formaterJourMoisNumerique(bon.expire_le) });
}

/** Libellé de la case du panier. */
export function libelleUtiliserBon(bon: BonClient, t: TextesBons, langue: Langue): string {
  if (bon.origine === "bienvenue") return remplir(t.utiliserBonBienvenue, { montant: formaterPrix(bon.montant, langue) });
  if (bon.origine === "campagne") return remplir(t.utiliserBonProgramme, { nom: (langue === "ar" ? bon.nom_ar : bon.nom_fr) ?? bon.nom_fr ?? "", montant: formaterPrix(bon.montant, langue) });
  return t.utiliserBon;
}
