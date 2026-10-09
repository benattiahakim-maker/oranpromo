// US-20.2 : panier d’une seule boutique, gardé dans le navigateur (localStorage).
// Les prix du panier sont indicatifs : la base les recalcule à la commande (passer_commande).

export const CLE_PANIER = "oranpromo:panier";
export const EVENEMENT_PANIER = "oranpromo:panier";
export const LIGNES_PANIER_MAX = 10;
export const QUANTITE_LIGNE_MAX = 10;
export const NOTE_COMMANDE_MAX = 300;

export type LignePanier = { articleId: string; titre: string; taille: string; quantite: number; prix: number; photo: string | null };
export type Panier = { boutiqueId: string; boutiqueNom: string; lignes: LignePanier[] };
export type BoutiquePanier = { id: string; nom: string };

export class ErreurAutreBoutique extends Error {
  constructor(public boutiqueNom: string) { super(`Votre panier contient déjà des articles de ${boutiqueNom}. Une commande ne concerne qu’une boutique.`); }
}
export class ErreurPanier extends Error {}

const texte = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const entier = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Lit un panier enregistré ; toute donnée invalide donne un panier vide (null). */
export function lirePanier(brut: string | null | undefined): Panier | null {
  if (!brut) return null;
  try {
    const v = JSON.parse(brut);
    if (!v || !texte(v.boutiqueId, 64) || !texte(v.boutiqueNom, 200) || !Array.isArray(v.lignes)) return null;
    const lignes = (v.lignes as unknown[]).filter((l): l is LignePanier => {
      const ligne = l as Record<string, unknown>;
      return Boolean(ligne) && texte(ligne.articleId, 64) && texte(ligne.titre, 200) && texte(ligne.taille, 40)
        && entier(ligne.quantite, 1, QUANTITE_LIGNE_MAX) && entier(ligne.prix, 1, 100_000_000)
        && (ligne.photo === null || texte(ligne.photo, 2000));
    }).slice(0, LIGNES_PANIER_MAX);
    return lignes.length ? { boutiqueId: v.boutiqueId, boutiqueNom: v.boutiqueNom, lignes } : null;
  } catch { return null; }
}

/** Ajoute (ou cumule) une ligne. `stock` = quantité connue de la taille ; `remplacer` vide d’abord un panier d’une autre boutique. */
export function ajouterAuPanier(panier: Panier | null, boutique: BoutiquePanier, ligne: LignePanier, stock: number, remplacer = false): Panier {
  if (panier && panier.boutiqueId !== boutique.id && !remplacer) throw new ErreurAutreBoutique(panier.boutiqueNom);
  const base = panier && panier.boutiqueId === boutique.id ? panier : { boutiqueId: boutique.id, boutiqueNom: boutique.nom, lignes: [] };
  const maximum = Math.min(QUANTITE_LIGNE_MAX, Math.max(0, Math.trunc(stock)));
  if (!entier(ligne.quantite, 1, QUANTITE_LIGNE_MAX)) throw new ErreurPanier(`Choisissez une quantité entre 1 et ${QUANTITE_LIGNE_MAX}.`);
  const existante = base.lignes.find(l => l.articleId === ligne.articleId && l.taille === ligne.taille);
  const quantite = (existante?.quantite ?? 0) + ligne.quantite;
  if (maximum === 0) throw new ErreurPanier("Cette taille est épuisée.");
  if (quantite > maximum) throw new ErreurPanier(maximum === 1 ? "Il ne reste qu’une pièce dans cette taille." : `Vous pouvez commander au plus ${maximum} pièces dans cette taille.`);
  if (!existante && base.lignes.length >= LIGNES_PANIER_MAX) throw new ErreurPanier(`Un panier contient au plus ${LIGNES_PANIER_MAX} articles différents.`);
  const lignes = existante ? base.lignes.map(l => l === existante ? { ...l, quantite, prix: ligne.prix, titre: ligne.titre, photo: ligne.photo } : l) : [...base.lignes, ligne];
  return { ...base, lignes };
}

export function changerQuantitePanier(panier: Panier, articleId: string, taille: string, quantite: number): Panier {
  const q = Math.min(QUANTITE_LIGNE_MAX, Math.max(1, Math.trunc(quantite)));
  return { ...panier, lignes: panier.lignes.map(l => l.articleId === articleId && l.taille === taille ? { ...l, quantite: q } : l) };
}

/** Retire une ligne ; un panier vide devient null. */
export function retirerDuPanier(panier: Panier, articleId: string, taille: string): Panier | null {
  const lignes = panier.lignes.filter(l => !(l.articleId === articleId && l.taille === taille));
  return lignes.length ? { ...panier, lignes } : null;
}

export function totalPanier(panier: Panier | null): number {
  return panier ? panier.lignes.reduce((total, l) => total + l.prix * l.quantite, 0) : 0;
}

export function nombreArticlesPanier(panier: Panier | null): number {
  return panier ? panier.lignes.reduce((total, l) => total + l.quantite, 0) : 0;
}

/** Lignes envoyées à passer_commande() : seuls l’article, la taille et la quantité comptent. */
export function lignesCommande(panier: Panier): { article_id: string; taille: string; quantite: number }[] {
  return panier.lignes.map(l => ({ article_id: l.articleId, taille: l.taille, quantite: l.quantite }));
}

export function noteCommandeValide(note: string): boolean {
  return note.trim().length <= NOTE_COMMANDE_MAX;
}

// --- Stockage navigateur -----------------------------------------------------
export function chargerPanierLocal(): Panier | null {
  try { return lirePanier(localStorage.getItem(CLE_PANIER)); } catch { return null; }
}

export function sauverPanierLocal(panier: Panier | null) {
  try {
    if (panier) localStorage.setItem(CLE_PANIER, JSON.stringify(panier)); else localStorage.removeItem(CLE_PANIER);
  } catch { /* Stockage indisponible : le panier reste en mémoire pour cette page. */ }
  window.dispatchEvent(new Event(EVENEMENT_PANIER));
}

/** Abonnement pour useSyncExternalStore : changements dans cet onglet et dans les autres. */
export function abonnerPanier(rappel: () => void): () => void {
  const surStockage = (event: StorageEvent) => { if (event.key === null || event.key === CLE_PANIER) rappel(); };
  window.addEventListener(EVENEMENT_PANIER, rappel);
  window.addEventListener("storage", surStockage);
  return () => { window.removeEventListener(EVENEMENT_PANIER, rappel); window.removeEventListener("storage", surStockage); };
}

/** Valeur brute (chaîne) pour useSyncExternalStore : stable tant que le panier ne change pas. */
export function panierBrut(): string {
  try { return localStorage.getItem(CLE_PANIER) ?? ""; } catch { return ""; }
}
