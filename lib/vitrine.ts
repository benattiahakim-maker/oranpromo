import { promoActive, type Promo } from "./prix";

export function trierArticlesVitrine<T extends { cree_le: string; promo: Promo | null }>(articles: T[], maintenant = new Date()): T[] {
  return [...articles].sort((a, b) => Number(promoActive(b.promo, maintenant)) - Number(promoActive(a.promo, maintenant)) || new Date(b.cree_le).getTime() - new Date(a.cree_le).getTime());
}

export function positionBoutique(latitude: number | null, longitude: number | null, adresse: string | null, quartier: string): string {
  return latitude !== null && longitude !== null ? `${latitude},${longitude}` : `${adresse ? `${adresse}, ` : ""}${quartier}, Oran, Algérie`;
}
