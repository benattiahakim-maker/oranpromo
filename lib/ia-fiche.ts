import { CATEGORIES_ARTICLE, GENRES_ARTICLE, couleurDepuisIA } from "./article";

export const IA_INDISPONIBLE = "L’IA est indisponible, remplissez la fiche à la main";
export const PHOTO_A_REPRENDRE = "Prenez une autre photo du vêtement, bien éclairée et nette";
export const CHAMPS_IA = ["titre", "description", "categorie", "genre", "couleur"] as const;
export type ChampIA = typeof CHAMPS_IA[number];
export type FicheIA = Record<ChampIA, string>;
export class ErreurPhotoIA extends Error {}

// Supprimer une proposition douteuse entière plutôt que laisser une affirmation commerciale.
const interdit = /\b(marque|logo|authenti\w*|original\w*|contrefa\w*|replica|réplique|nike|adidas|puma|zara|gucci|lacoste|prada|chanel|dior|balenciaga|hermès|hermes|vuitton|armani|versace|fendi|reebok|fila|levi['’]?s?|ralph|tommy|calvin|boss|h&m|uniqlo|burberry|supreme|new balance|under armour|prix|dinars?|da|euros?|taille|pointure)\b/i;
const motsMajusculesAutorises = new Set("un une le la les ce cette des de du il elle polo polos t-shirt t-shirts chemise chemises pull pulls sweat sweats veste vestes manteau manteaux doudoune doudounes pantalon pantalons jean jeans survêtement survêtements ensemble ensembles jogging robe robes jupe jupes abaya abayas djellaba djellabas kamis qamis gandoura caftan karakou blouza tenue tenues traditionnelle traditionnelles hijab hijabs foulard foulards sac sacs chaussure chaussures accessoires parfum parfums musc oud ambre eau maquillage rouge palette fard mascara crayon vernis poudre fond teint soin soins crème crèmes lait huile sérum gel savon shampoing shampooing après-shampoing masque cheveux visage corps hammam ghassoul henné khôl kohl gant kessa flacon pot tube coffret avec sans manches coupe col tissu bleu bleue noir noire blanc blanche rouge vert verte gris grise beige marron rose jaune orange violet violette multicolore coton aspect motif motifs et sa son ses vêtement vetement comporte présente présentez porte matière manches longues courtes fermeture boutons capuche rayures rayé rayée homme femme enfant mixte".split(" "));
const vocabulaireDescriptif = new Set([...motsMajusculesAutorises, ..."à a au aux d l en sur est sont lèvres yeux ongles paupières cils teint mains peau noir beauté bouchon vaporisateur pompe applicateur pinceau étui boîte bocal verre plastique métal transparent pâte poudre liquide solide naturel naturelle traditionnel femme homme se par pour ou qui que une ce cet ces deux principal principale uni unie unis unies foncé foncée clair claire marine bordeaux turquoise kaki écru écrue crème argenté argentée doré dorée imprimé imprimée fleurs floral florale géométrique géométriques droit droite droits droites large ample ajusté ajustée cintré cintrée court courte long longue fin fine épais épaisse rond ronde montant ouverte ouvert boutonné boutonnée boutonnée boutonnée boutonnage zippé zippée zip poche poches poitrine devant dos latérales latérale élastique élastiqué élastiquée plis plissé plissée maille tricot tissé tissée piqué piquée lisse texturé texturée côtelé côtelée côtelées denim cuir visible visibles présente présentent petit petite petits petites discret discrète bord bords ourlet contrasté contrastée contrastants contrastantes décoratif décorative détails détail bout ceinture semelle lacets lacet baskets basket bottes botte sandales sandale mocassins chaussure veste manteau blouson cardigan sweat sweatshirt débardeur short bermuda écharpe foulard bonnet sac accessoire bande bandes rayures rayure verticales horizontales blanc cassé blanche cassée surpiqûres surpiqûre arrondi arrondie souple forme simple motif opaque transparent transparente transparentes arrondis arrondies tissu tissage texture relief longueur basse haute taille haute silhouette doublure ourlets couture coutures revers devant bas haut uniforme régulières régulière boutons bouton visibles vêtement vêtements".split(" ")]);
function texteSur(texte: string): boolean {
  if (interdit.test(texte) || /[“”«»"]/.test(texte)) return false;
  // Un nom propre non descriptif ne doit pas devenir une marque dans la fiche.
  // Vocabulaire fermé : même une marque inconnue ou écrite en minuscules est écartée.
  const mots = texte.toLocaleLowerCase("fr").replace(/['’]/g, " ").match(/[\p{L}\p{N}]+(?:-[\p{L}]+)*/gu) ?? [];
  return mots.every(mot => vocabulaireDescriptif.has(mot));
}
export function validerFicheIA(valeur: unknown): FicheIA {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) throw new Error(IA_INDISPONIBLE);
  const v = valeur as Record<string, unknown>;
  if (typeof v.estVetement !== "boolean" || typeof v.nette !== "boolean") throw new Error(IA_INDISPONIBLE);
  if (!v.estVetement || !v.nette) throw new ErreurPhotoIA(PHOTO_A_REPRENDRE);
  if (Object.keys(v).some(c => ![...CHAMPS_IA, "estVetement", "nette"].includes(c))) throw new Error(IA_INDISPONIBLE);
  if (CHAMPS_IA.some(c => typeof v[c] !== "string")) throw new Error(IA_INDISPONIBLE);
  const fiche = Object.fromEntries(CHAMPS_IA.map(c => [c, (v[c] as string).trim()])) as FicheIA;
  if (Array.from(fiche.titre).length < 2 || Array.from(fiche.titre).length > 120 || fiche.description.length > 600 || fiche.couleur.length > 80 || !CATEGORIES_ARTICLE.some(c => c === fiche.categorie) || !GENRES_ARTICLE.some(g => g === fiche.genre)) throw new Error(IA_INDISPONIBLE);
  const phrases = fiche.description.match(/[^.!?]+[.!?]?/g) ?? [];
  fiche.description = phrases.filter(texteSur).slice(0, 2).map(p => p.trim()).join(" ");
  fiche.couleur = couleurDepuisIA(fiche.couleur);
  if (!texteSur(fiche.titre)) fiche.titre = fiche.categorie;
  return fiche;
}

export function champsVidesAPreRemplir(saisie: FicheIA, proposition: FicheIA): Partial<FicheIA> {
  const normalisee = { ...proposition, couleur: couleurDepuisIA(proposition.couleur) };
  return Object.fromEntries(CHAMPS_IA.filter(c => !saisie[c].trim() && normalisee[c]).map(c => [c, normalisee[c]]));
}
