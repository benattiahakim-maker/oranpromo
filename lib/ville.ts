// US-29.2 : ville choisie par le client (adresse /oran/… et cookie « ville », comme la langue, sans compte).
// Fonctions pures (serveur et navigateur) ; la lecture de la base est dans lib/ville-serveur.ts.
import { cheminSuite } from "./chemin";

export const COOKIE_VILLE = "ville";
/** Le choix est gardé un an (comme la langue). */
export const DUREE_COOKIE_VILLE = 60 * 60 * 24 * 365;

/**
 * Mots déjà pris par une page ou un fichier du site : jamais un code de ville (sinon /<code> ouvrirait la page).
 * Même liste que les contraintes villes_code_libre et villes_code_libre_juridique (US-34.1) de la base ; un test vérifie
 * que chaque dossier de app/ y est.
 */
export const CODES_RESERVES: readonly string[] = [
  "a", "b", "i", "p", "admin", "api", "apercu-local", "auth", "campagne", "carte", "catalogue", "compte", "conditions", "conditions-commercants",
  "confidentialite", "confirmer", "espace", "favicon",
  "images", "langue", "manifest", "panier", "parrainage", "retrait", "robots", "sitemap", "ville", "villes", "visiteurs",
];

/** Ville telle que lue par villes_ouvertes() (bornes et centre pour la carte et « Me localiser »). */
export type Ville = {
  code: string; pays: string; nom: string; nom_ar: string;
  lat_min: number; lat_max: number; lng_min: number; lng_max: number;
  centre_lat: number; centre_lng: number; zoom: number; boutiques: number;
};

/** Oran telle que dans la base (migration 20261013090000_villes.sql) : secours si la base ne répond pas. */
export const VILLE_ORAN: Ville = {
  code: "oran", pays: "DZ", nom: "Oran", nom_ar: "وهران",
  lat_min: 35.33, lat_max: 35.92, lng_min: -1.15, lng_max: -0.10, centre_lat: 35.6971, centre_lng: -0.6337, zoom: 12, boutiques: 0,
};

/** Forme d'un code (minuscules, tirets, 2 à 30 caractères) et pas un mot réservé. */
export function codeVilleValide(code: string | null | undefined): code is string {
  return typeof code === "string" && /^[a-z][a-z-]{1,29}$/.test(code) && !CODES_RESERVES.includes(code);
}

/**
 * Ville à ouvrir sans ville dans l'adresse (« / », « /catalogue », « /carte ») :
 * celle du cookie si elle est ouverte ; sinon la seule ville ouverte ; sinon aucune (page de choix /villes).
 */
export function villeParDefaut(cookie: string | null | undefined, ouvertes: readonly Pick<Ville, "code">[]): string | null {
  if (cookie && ouvertes.some(v => v.code === cookie)) return cookie;
  return ouvertes.length === 1 ? ouvertes[0].code : null;
}

/** Nom de la ville dans la langue du visiteur. */
export function nomVille(ville: Pick<Ville, "nom" | "nom_ar">, langue: "fr" | "ar"): string {
  return langue === "ar" ? ville.nom_ar : ville.nom;
}

/** « d'Oran », « d'Alger », « de Tlemcen » (élision devant une voyelle ou un h, comme prive.de_ville dans la base). */
export function deVille(nom: string): string {
  return /^[aeiouyàâäéèêëîïôöùûüh]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

/** Valeur de {deVille} dans les textes : « d’Oran » en français, le nom seul en arabe (« بروموات وهران »). */
export function deVilleEnLangue(ville: Pick<Ville, "nom" | "nom_ar">, langue: "fr" | "ar"): string {
  return langue === "ar" ? ville.nom_ar : deVille(ville.nom);
}

/** Ville contenant la position (bornes de la base) ; la première dans l'ordre si plusieurs se recouvrent. */
export function villeDeLaPosition<V extends Pick<Ville, "lat_min" | "lat_max" | "lng_min" | "lng_max">>(villes: readonly V[], latitude: number, longitude: number): V | null {
  return villes.find(v => latitude >= v.lat_min && latitude <= v.lat_max && longitude >= v.lng_min && longitude <= v.lng_max) ?? null;
}

/**
 * Chemin interne sûr, sinon null. Relecture n°6, point 3 : même contrôle que la connexion (`cheminSuite`) : ni « //… »,
 * ni « /\… », ni caractère de contrôle ou espace (« /\t/evil.com » devenait « //evil.com » pour le navigateur), même encodé
 * (« /%09/evil.com »), et l'origine doit rester celle du site.
 */
function cheminInterne(chemin: string | null | undefined): string | null {
  return chemin ? cheminSuite(chemin) : null;
}

/**
 * Page à ouvrir après le choix d'une ville : la même page dans la nouvelle ville (« /oran/catalogue?q=robe » →
 * « /tlemcen/catalogue?q=robe ») ; une ancienne adresse sans ville (« /catalogue ») passe dans la ville ;
 * une page globale (« /panier ») reste telle quelle ; rien ou adresse douteuse → accueil de la ville.
 */
export function cheminApresChoix(code: string, retour: string | null | undefined, codesVilles: readonly string[]): string {
  const chemin = cheminInterne(retour);
  if (!chemin) return `/${code}`;
  const [avant, ...reste] = chemin.split(/(?=[?#])/);
  const suite = reste.join("");
  const segments = avant.split("/").filter(Boolean);
  if (!segments.length) return `/${code}${suite}`;
  if (codesVilles.includes(segments[0])) return `/${[code, ...segments.slice(1)].join("/")}${suite}`;
  if (segments[0] === "catalogue" || segments[0] === "carte") return `/${code}/${segments.join("/")}${suite}`;
  if (segments[0] === "villes") return `/${code}`;
  return chemin;
}

/** Chemin d'une page de la ville : cheminVille("oran", "/catalogue?promo=1") → « /oran/catalogue?promo=1 ». */
export function cheminVille(code: string, suite = ""): string {
  return `/${code}${suite === "/" ? "" : suite}`;
}

/** Ville lue avec une boutique (« villes(nom) ») : objet, tableau d'un élément selon le client, ou rien (ville fermée). */
export function villeLue<T>(valeur: T | T[] | null | undefined): T | null {
  return Array.isArray(valeur) ? valeur[0] ?? null : valeur ?? null;
}
