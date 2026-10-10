import type { Langue } from "./langue";
import { UNIVERS, type CleUnivers } from "./article";
import { articleDansUnivers } from "./catalogue";
import { positionBoutique } from "./vitrine";
import type { Position } from "./position";

// US-24 : fond de carte (un seul endroit pour changer de fournisseur, voir docs/architecture.md).
// CARTO Positron avec la clé publique NEXT_PUBLIC_CARTO_CLE (usage commercial gratuit jusqu'à 1 M de tuiles par mois) ;
// sans clé (développement sur le PC) : tuiles d'OpenStreetMap, à ne pas utiliser en production.
export type FondDeCarte = { url: string; attribution: string; sousDomaines: string; zoomMax: number; fournisseur: 'carto' | 'osm' };

const ATTRIBUTION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function fondDeCarte(cle: string | undefined): FondDeCarte {
  const propre = cle?.trim();
  if (propre) {
    return {
      fournisseur: 'carto',
      url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(propre)}`,
      attribution: `${ATTRIBUTION_OSM}, &copy; <a href="https://carto.com/attributions">CARTO</a>`,
      sousDomaines: 'abcd',
      zoomMax: 19,
    };
  }
  return { fournisseur: 'osm', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: ATTRIBUTION_OSM, sousDomaines: 'abc', zoomMax: 19 };
}

// ---------------------------------------------------------------------------
// US-24.3 : page /carte. Tout se calcule dans le navigateur : la position de la cliente n'en sort jamais.
// ---------------------------------------------------------------------------

export type BoutiqueCarte = { id: string; slug: string; nom: string; quartier: string; latitude: number | null; longitude: number | null; promos: number; univers: CleUnivers[] };
export type LigneBoutiquesCarte = { id: string; slug: string; nom: string; quartier: string; latitude: number | null; longitude: number | null; promos_en_cours: number | null; rayons: unknown };

// Localisation de la cliente (« Autour de moi ») : la précision du quartier suffit, 15 s au plus, 1 min de cache.
export const OPTIONS_LOCALISATION_CLIENTE: PositionOptions = { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 };
// Après « Autour de moi », la carte ne zoome pas plus que 15 (une tuile ≈ 1 km à Oran).
export const ZOOM_MAX_AUTOUR = 15;

// Univers d'une boutique, à partir des couples catégorie / genre de ses articles visibles (même règle que le catalogue).
export function universBoutique(rayons: unknown): CleUnivers[] {
  if (!Array.isArray(rayons)) return [];
  const articles = rayons.filter((r): r is { categorie: string; genre: string } => typeof r?.categorie === "string" && typeof r?.genre === "string");
  return UNIVERS.map(u => u.cle).filter(cle => articles.some(article => articleDansUnivers(article, cle)));
}

export function versBoutiquesCarte(lignes: LigneBoutiquesCarte[]): BoutiqueCarte[] {
  return lignes.map(ligne => {
    const position = ligne.latitude !== null && ligne.longitude !== null && Number.isFinite(ligne.latitude) && Number.isFinite(ligne.longitude);
    return { id: ligne.id, slug: ligne.slug, nom: ligne.nom, quartier: ligne.quartier, latitude: position ? ligne.latitude : null, longitude: position ? ligne.longitude : null, promos: Math.max(0, ligne.promos_en_cours ?? 0), univers: universBoutique(ligne.rayons) };
  });
}

export function filtrerParUnivers(boutiques: BoutiqueCarte[], univers: CleUnivers | null): BoutiqueCarte[] {
  return univers ? boutiques.filter(b => b.univers.includes(univers)) : boutiques;
}

export function aPosition(boutique: BoutiqueCarte): boutique is BoutiqueCarte & Position {
  return boutique.latitude !== null && boutique.longitude !== null;
}

// Distance à vol d'oiseau (formule de haversine, rayon moyen de la Terre).
export function distanceMetres(a: Position, b: Position): number {
  const rayon = 6371008.8, rad = (degres: number) => (degres * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * rayon * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Boutiques placées, de la plus proche à la plus éloignée (à égalité : par nom).
export function trierParDistance<T extends BoutiqueCarte>(boutiques: T[], origine: Position): (T & Position & { distance: number })[] {
  return boutiques.filter((b): b is T & Position => aPosition(b)).map(b => ({ ...b, distance: distanceMetres(origine, b) }))
    .sort((a, b) => a.distance - b.distance || a.nom.localeCompare(b.nom, "fr"));
}

// « 850 m », « 2,4 km », « 12 km » ; en arabe « 850 م », « 2,4 كم » (chiffres 0-9).
export function formaterDistance(metres: number, langue: Langue): string {
  const [m, km] = langue === "ar" ? ["م", "كم"] : ["m", "km"];
  if (metres < 950) return `${Math.max(10, Math.round(metres / 10) * 10)} ${m}`;
  const kilometres = metres / 1000;
  return `${kilometres < 9.95 ? kilometres.toFixed(1).replace(".", ",") : Math.round(kilometres)} ${km}`;
}

// Itinéraire Google Maps vers la boutique (sans la position de la cliente : Google la demande lui-même).
// US-29.3 : « ville » = nom de la ville de la boutique (Oran si absent, comme avant ; null : aucun).
export function lienItineraire(boutique: { latitude: number | null; longitude: number | null; adresse?: string | null; quartier: string; ville?: string | null }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(positionBoutique(boutique.latitude, boutique.longitude, boutique.adresse ?? null, boutique.quartier, boutique.ville === undefined ? "Oran" : boutique.ville))}`;
}
