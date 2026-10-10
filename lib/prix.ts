import { isolerGaucheDroite, type Langue } from "@/lib/langue";

// Calcul et affichage des prix. Les prix sont des entiers en dinars (DA).

export type Promo = {
  prixPromo: number;
  dateFin: string; // ISO 8601, ex. "2026-10-18T23:59:59+01:00"
};

/** Une promo est active tant que sa date de fin n'est pas passée. */
export function promoActive(promo: Promo | null | undefined, maintenant: Date = new Date()): boolean {
  if (!promo) return false;
  return new Date(promo.dateFin).getTime() >= maintenant.getTime();
}

/** Prix à afficher : le prix promo si la promo est active, sinon le prix normal. */
export function prixAffiche(prix: number, promo: Promo | null | undefined, maintenant: Date = new Date()): number {
  return promoActive(promo, maintenant) ? promo!.prixPromo : prix;
}

/** Réduction en pourcentage, arrondie à l'entier : 4500 → 3500 donne 22. */
export function pourcentageReduction(prix: number, prixPromo: number): number {
  if (prix <= 0) return 0;
  return Math.round(((prix - prixPromo) / prix) * 100);
}

/** Format français : 3500 → "3 500 DA". En arabe (US-23) : "3 500 دج", le nombre isolé de gauche à droite. */
export function formaterPrix(montant: number, langue: Langue = "fr"): string {
  const chiffres = chiffresPrix(montant);
  return langue === "ar" ? `${isolerGaucheDroite(chiffres)}\u00a0دج` : `${chiffres}\u00a0DA`;
}

/** Chiffres seuls, groupés par milliers avec une espace insécable : 3500 → "3 500". */
export function chiffresPrix(montant: number): string {
  // Intl utilise une espace fine insécable : on la remplace par une espace insécable classique.
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(montant).replace(/\u202f/g, "\u00a0");
}
