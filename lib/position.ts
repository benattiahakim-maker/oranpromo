// US-24 : position d'une boutique sur la carte.
// Bornes de la wilaya d'Oran : même rectangle que la base (migration 20261010210000_carte_boutiques.sql),
// d'après la limite OpenStreetMap de la wilaya (relation 1259187), arrondi vers l'extérieur.
export const BORNES_ORAN = {
  latMin: 35.33,
  latMax: 35.92,
  lngMin: -1.15,
  lngMax: -0.1,
} as const;

// Centre par défaut de la carte : place du 1er Novembre, Oran.
export const CENTRE_ORAN = { latitude: 35.6971, longitude: -0.6337 } as const;

export const MESSAGE_HORS_ORAN = "La position doit être dans la wilaya d'Oran.";
export const MESSAGE_POSITION_INCOMPLETE = 'Saisissez la latitude et la longitude, ou aucune des deux.';

// true si le point est dans le rectangle de la wilaya d'Oran (bornes comprises). NaN et l'infini sont refusés.
export function dansOran(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= BORNES_ORAN.latMin &&
    latitude <= BORNES_ORAN.latMax &&
    longitude >= BORNES_ORAN.lngMin &&
    longitude <= BORNES_ORAN.lngMax
  );
}
