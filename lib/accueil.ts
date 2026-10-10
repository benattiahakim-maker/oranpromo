import { CATEGORIES_ARTICLE, UNIVERS, type CleUnivers } from "./article";

// Images de la page d'accueil : visuels fixes de la marque, rangés dans public/images/accueil/ (WebP).
// - grande photo : vraie photo d'Oran (Santa Cruz au-dessus du port), Wikimedia Commons, licence libre :
//   le crédit (auteur, licence, source) est affiché sur la page, voir CREDIT_GRANDE_PHOTO ;
// - tuiles univers et « pièces phares » : images générées par IA pour OranPromo (propriété du projet).
// Aucune image externe chargée à l'affichage.
export const PIECES_PHARES = ["Robes", "Abayas, djellabas, kamis", "T-shirts et polos", "Pantalons et jeans", "Chaussures", "Parfums"] as const;

const DOSSIER = "/images/accueil";

export type ImageAccueil = { adresse: string; alt: string };
export type TuileAccueil = { nom: string; lien: string; image: ImageAccueil };
export type CreditPhoto = { auteur: string; licence: string; lienLicence: string; source: string; lienSource: string };

/** Grande photo d'accueil (décorative : alt vide), cadrée sur le fort de Santa Cruz. */
export const GRANDE_PHOTO: ImageAccueil & { position: string } = { adresse: `${DOSSIER}/accueil-santa-cruz.webp`, alt: "", position: "50% 20%" };

/** US-29.3 (question 7) : photo commune neutre pour les villes sans photo à elles (image du projet, sans crédit à afficher). */
export const GRANDE_PHOTO_COMMUNE: ImageAccueil & { position: string } = { adresse: `${DOSSIER}/cat-robes.webp`, alt: "", position: "50% 40%" };

/** Crédit obligatoire (CC BY-SA 4.0) de la grande photo, affiché sous le bouton. Photo recadrée et compressée par OranPromo. */
export const CREDIT_GRANDE_PHOTO: CreditPhoto = {
  auteur: "Bachounda",
  licence: "CC BY-SA 4.0",
  lienLicence: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr",
  source: "Wikimedia Commons",
  lienSource: "https://commons.wikimedia.org/wiki/File:Santa_cruz_Oran.jpg",
};

const IMAGES_UNIVERS: Record<CleUnivers, ImageAccueil> = {
  femme: { adresse: `${DOSSIER}/univers-femme.webp`, alt: "Robe terracotta et sac en cuir sur un mur blanc ensoleillé" },
  homme: { adresse: `${DOSSIER}/univers-homme.webp`, alt: "Chemise en lin, pantalon beige, ceinture et baskets blanches sur un banc" },
  enfant: { adresse: `${DOSSIER}/univers-enfant.webp`, alt: "Robe jaune, t-shirt rayé et salopette en jean d’enfant sur un portant" },
  beaute: { adresse: `${DOSSIER}/univers-beaute.webp`, alt: "Parfums, rouge à lèvres et crème sur un plateau en cuivre" },
};

const IMAGES_PIECES_PHARES: Record<typeof PIECES_PHARES[number], ImageAccueil> = {
  "Robes": { adresse: `${DOSSIER}/cat-robes.webp`, alt: "Robes colorées sur un portant près d’une fenêtre" },
  "Abayas, djellabas, kamis": { adresse: `${DOSSIER}/cat-abayas-djellabas-kamis.webp`, alt: "Djellabas brodées et kamis blanc sur cintres devant des zelliges" },
  "T-shirts et polos": { adresse: `${DOSSIER}/cat-tshirts-polos.webp`, alt: "Pile de t-shirts et de polos de couleur" },
  "Pantalons et jeans": { adresse: `${DOSSIER}/cat-pantalons-jeans.webp`, alt: "Piles de jeans et de pantalons pliés" },
  "Chaussures": { adresse: `${DOSSIER}/cat-chaussures.webp`, alt: "Baskets, mocassins et sandales sur un sol en tomettes" },
  "Parfums": { adresse: `${DOSSIER}/cat-parfums.webp`, alt: "Flacons de parfum sur du marbre face à la mer" },
};

export function lienUnivers(cle: CleUnivers): string {
  return `/catalogue?univers=${cle}`;
}

export function lienCategorie(categorie: string): string {
  return `/catalogue?${new URLSearchParams({ categorie })}`;
}

export const TUILES_UNIVERS: TuileAccueil[] = UNIVERS.map(u => ({ nom: u.nom, lien: lienUnivers(u.cle), image: IMAGES_UNIVERS[u.cle] }));
export const TUILES_PIECES_PHARES: TuileAccueil[] = PIECES_PHARES.filter(c => CATEGORIES_ARTICLE.some(x => x === c)).map(c => ({ nom: c, lien: lienCategorie(c), image: IMAGES_PIECES_PHARES[c] }));

/** US-29.3 : grande photo de l'accueil d'une ville et son crédit (null : rien à créditer). Oran : Santa Cruz, comme avant. */
export function grandePhotoVille(code: string): { photo: ImageAccueil & { position: string }; credit: CreditPhoto | null } {
  return code === "oran" ? { photo: GRANDE_PHOTO, credit: CREDIT_GRANDE_PHOTO } : { photo: GRANDE_PHOTO_COMMUNE, credit: null };
}
