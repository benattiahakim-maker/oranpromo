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

/** Format français : 3500 → "3 500 DA". */
export function formaterPrix(montant: number): string {
  const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(montant);
  // Intl utilise une espace fine insécable : on la remplace par une espace insécable classique.
  return `${nombre.replace(/ /g, " ")} DA`;
}
