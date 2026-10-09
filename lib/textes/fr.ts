// US-23 : textes français de l'interface (langue par défaut). Les mêmes clés existent en arabe (ar.ts).
// Les {noms} sont remplacés par remplir() de lib/langue.ts.

export const fr = {
  entete: {
    navigation: "Navigation du site",
    rechercher: "Rechercher",
    panier: "Panier",
    panierAvecNombre: "Panier ({n})",
  },
  langue: {
    groupe: "Langue",
    // Le bouton montre l'autre langue, écrite dans sa propre langue.
    autre: "عربي",
    autreNom: "العربية",
    autreCode: "ar",
  },
  erreur: {
    titre: "Une erreur est survenue",
    reessayer: "Réessayer",
  },
  introuvable: {
    titre: "Page introuvable",
    retour: "Retour à l’accueil",
  },
};

export type Textes = typeof fr;
