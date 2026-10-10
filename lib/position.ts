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

// US-29.4 : zone d'une ville (ligne de la table villes) : bornes, centre et nom pour le message.
export type ZoneVille = { nom: string; lat_min: number; lat_max: number; lng_min: number; lng_max: number; centre_lat: number; centre_lng: number };
/** Oran : les mêmes valeurs qu'avant (BORNES_ORAN, CENTRE_ORAN), défaut de toutes les fonctions ci-dessous. */
export const ZONE_ORAN: ZoneVille = {
  nom: "Oran", lat_min: BORNES_ORAN.latMin, lat_max: BORNES_ORAN.latMax, lng_min: BORNES_ORAN.lngMin, lng_max: BORNES_ORAN.lngMax,
  centre_lat: CENTRE_ORAN.latitude, centre_lng: CENTRE_ORAN.longitude,
};

/** « La position doit être dans la wilaya d'Oran. », « … de Tlemcen. » : même texte que la base (prive.de_ville, apostrophe droite). */
export function messageHorsVille(nom: string): string {
  return `La position doit être dans la wilaya ${/^[aeiouyàâäéèêëîïôöùûüh]/i.test(nom) ? `d'${nom}` : `de ${nom}`}.`;
}

// true si le point est dans le rectangle de la zone (bornes comprises). NaN et l'infini sont refusés.
export function dansZone(zone: ZoneVille, latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= zone.lat_min &&
    latitude <= zone.lat_max &&
    longitude >= zone.lng_min &&
    longitude <= zone.lng_max
  );
}

// true si le point est dans le rectangle de la wilaya d'Oran (bornes comprises). NaN et l'infini sont refusés.
export function dansOran(latitude: number, longitude: number): boolean {
  return dansZone(ZONE_ORAN, latitude, longitude);
}

// ---------------------------------------------------------------------------
// US-24.2 : saisie de la position (création, /admin/boutiques, /espace).
// ---------------------------------------------------------------------------

export const MESSAGE_POSITION_PUBLIEE = 'Pour déplacer votre boutique sur la carte, contactez BleDeal.';
export const MESSAGE_LIEN_COURT =
  'Ce lien court ne contient pas la position. Ouvrez-le dans Google Maps, puis copiez l’adresse complète depuis la barre du navigateur (elle contient « @35,… »), ou utilisez « Je suis dans la boutique ».';
export const MESSAGE_LIEN_INTROUVABLE = 'Coordonnées introuvables dans ce lien.';
export const MESSAGE_LOCALISATION_REFUSEE = 'Vous avez refusé la localisation. Collez un lien Google Maps ou placez l’épingle.';
export const MESSAGE_LOCALISATION_INTROUVABLE = 'Position introuvable pour le moment. Réessayez dehors ou près d’une fenêtre.';
export const MESSAGE_LOCALISATION_INDISPONIBLE = 'La localisation n’est pas disponible sur cet appareil. Collez un lien Google Maps ou placez l’épingle.';
// Au-delà, la position trouvée par le téléphone est jugée peu précise (avertissement, la position reste proposée).
export const PRECISION_MAX_METRES = 100;
// Options de la localisation du commerçant (dans la boutique, précision maximale, jamais une position en cache).
export const OPTIONS_LOCALISATION_BOUTIQUE: PositionOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

export type Position = { latitude: number; longitude: number };
export type LecturePosition = ({ ok: true } & Position) | { ok: false; raison: 'lien_court' | 'introuvable' | 'hors_oran' };

// 6 décimales ≈ 10 cm : bien assez pour une entrée de boutique.
export function arrondirCoordonnee(valeur: number): number {
  return Math.round(valeur * 1e6) / 1e6;
}

// « 35,697120 · −0,633750 » (virgule décimale, vrai signe moins).
export function formaterPosition(position: Position): string {
  const texte = (valeur: number) => valeur.toFixed(6).replace('.', ',').replace('-', '−');
  return `${texte(position.latitude)} · ${texte(position.longitude)}`;
}

// « Position trouvée · précision ± 12 m » ; avertissement au-delà de 100 m.
export function textePrecision(precisionMetres: number): { texte: string; avertissement: string | null } {
  const metres = Math.max(1, Math.round(precisionMetres));
  return {
    texte: `Position trouvée · précision ± ${metres} m`,
    avertissement:
      precisionMetres > PRECISION_MAX_METRES
        ? `Position peu précise (± ${metres} m) : activez la localisation précise ou le GPS, approchez-vous de la porte, ou déplacez l’épingle.`
        : null,
  };
}

const NOMBRE = String.raw`[+-]?\d{1,3}(?:\.\d+)?`;
const COUPLE_POINT = new RegExp(String.raw`^\s*(${NOMBRE})\s*,\s*(${NOMBRE})\s*$`);
const COUPLE_VIRGULE = new RegExp(String.raw`^\s*([+-]?\d{1,3}(?:,\d+)?)\s*[;\s]\s*([+-]?\d{1,3}(?:,\d+)?)\s*$`);
const PIN_LIEU = new RegExp(String.raw`!3d(${NOMBRE})!4d(${NOMBRE})`);
const CENTRE_VUE = new RegExp(String.raw`@(${NOMBRE}),(${NOMBRE})`);
const PARAMETRES = ['q', 'll', 'query', 'destination'] as const;

function couple(latitude: string, longitude: string): Position | null {
  const lat = Number(latitude.replace(',', '.')), lng = Number(longitude.replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: arrondirCoordonnee(lat), longitude: arrondirCoordonnee(lng) };
}

function lienCourt(url: URL): boolean {
  const hote = url.hostname.toLowerCase();
  return hote === 'maps.app.goo.gl' || (hote === 'goo.gl' && url.pathname.startsWith('/maps')) || hote === 'g.co';
}

function lienGoogleMaps(url: URL): boolean {
  const hote = url.hostname.toLowerCase();
  return /^maps\.google\.[a-z.]+$/.test(hote) || (/^(www\.)?google\.[a-z.]+$/.test(hote) && url.pathname.startsWith('/maps'));
}

function versUrl(texte: string): URL | null {
  const trouve = texte.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:google\.[a-z.]+|goo\.gl|g\.co)\/\S*/i)?.[0];
  if (!trouve) return null;
  try {
    return new URL(/^https?:\/\//i.test(trouve) ? trouve : `https://${trouve}`);
  } catch {
    return null;
  }
}

// Lit une position dans un lien Google Maps long ou dans deux nombres collés.
// Tout se passe dans le navigateur, sur le texte seul : aucun lien n'est ouvert ni suivi (ni ici, ni par le serveur),
// en particulier les liens courts (maps.app.goo.gl), qui ne contiennent pas la position.
export function coordonneesDepuisTexte(texte: string, zone: ZoneVille = ZONE_ORAN): LecturePosition {
  const propre = texte.replace(/[\u2212\u2013]/g, '-').trim();
  if (!propre) return { ok: false, raison: 'introuvable' };
  let position: Position | null = null;
  const url = versUrl(propre);
  if (url) {
    if (lienCourt(url)) return { ok: false, raison: 'lien_court' };
    if (!lienGoogleMaps(url)) return { ok: false, raison: 'introuvable' };
    let adresse = url.href;
    try {
      adresse = decodeURIComponent(url.href);
    } catch {
      // adresse mal encodée : on lit le texte tel quel
    }
    const pin = adresse.match(PIN_LIEU), centre = adresse.match(CENTRE_VUE);
    if (pin) position = couple(pin[1], pin[2]);
    else if (centre) position = couple(centre[1], centre[2]);
    else {
      for (const nom of PARAMETRES) {
        const valeur = url.searchParams.get(nom)?.replace(/^loc:/, '').match(COUPLE_POINT);
        if (valeur) {
          position = couple(valeur[1], valeur[2]);
          break;
        }
      }
    }
  } else {
    const valeur = propre.match(COUPLE_POINT) ?? propre.match(COUPLE_VIRGULE);
    if (valeur) position = couple(valeur[1], valeur[2]);
  }
  if (!position) return { ok: false, raison: 'introuvable' };
  if (!dansZone(zone, position.latitude, position.longitude)) return { ok: false, raison: 'hors_oran' };
  return { ok: true, ...position };
}

export function messageLecture(raison: 'lien_court' | 'introuvable' | 'hors_oran', zone: ZoneVille = ZONE_ORAN): string {
  return raison === 'lien_court' ? MESSAGE_LIEN_COURT : raison === 'hors_oran' ? messageHorsVille(zone.nom) : MESSAGE_LIEN_INTROUVABLE;
}

// Validation commune (écran et serveur) : les deux ou aucune, dans la wilaya d'Oran, arrondie à 6 décimales.
export function validerPosition(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  zone: ZoneVille = ZONE_ORAN,
): { ok: true; latitude: number | null; longitude: number | null } | { ok: false; message: string } {
  const vide = (valeur: unknown) => valeur === null || valeur === undefined;
  if (vide(latitude) && vide(longitude)) return { ok: true, latitude: null, longitude: null };
  if (vide(latitude) || vide(longitude)) return { ok: false, message: MESSAGE_POSITION_INCOMPLETE };
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !dansZone(zone, latitude, longitude)) return { ok: false, message: messageHorsVille(zone.nom) };
  return { ok: true, latitude: arrondirCoordonnee(latitude), longitude: arrondirCoordonnee(longitude) };
}

// Texte d'un champ « Latitude » / « Longitude » saisi à la main (virgule ou point) ; null si vide, NaN si illisible.
export function lireCoordonnee(valeur: string): number | null {
  const propre = valeur.replace(/[\u2212\u2013]/g, '-').trim();
  if (!propre) return null;
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(propre)) return Number.NaN;
  return Number(propre.replace(',', '.'));
}
