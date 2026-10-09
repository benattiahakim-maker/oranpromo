import { formaterPrix } from "./prix";

export type DemandeReservation = {
  telephoneBoutique: string; // format international, ex. "+213 555 12 34 56"
  titre: string;
  taille: string | null; // null pour un article en taille unique
  contenance?: boolean; // US-25.1 : produit de beauté, la taille est une contenance (« 100 ml ») écrite sans le mot « taille »
  prix: number; // prix affiché au client, en DA
  lien: string; // lien de la fiche, ex. "https://oranpromo.com/a/1234"
};

/** Numéro au format attendu par wa.me : chiffres uniquement, sans "+" ni espaces. */
export function numeroWhatsApp(telephone: string): string {
  return telephone.replace(/\D/g, "");
}

export function lienRelanceBoutique(telephone: string): string {
  return `https://wa.me/${numeroWhatsApp(telephone)}?text=${encodeURIComponent("Bonjour, pensez à mettre à jour vos articles sur OranPromo")}`;
}

/** Message pré-rempli de la réservation (US-07). */
export function messageReservation(d: DemandeReservation): string {
  const taille = d.taille ? (d.contenance ? `, ${d.taille}` : `, taille ${d.taille}`) : "";
  return `Bonjour, je souhaite réserver : ${d.titre}${taille}, ${formaterPrix(d.prix)}. ${d.lien} (vu sur OranPromo)`;
}

/** Lien qui ouvre WhatsApp vers la boutique avec le message pré-rempli. */
export function lienReservation(d: DemandeReservation): string {
  return `https://wa.me/${numeroWhatsApp(d.telephoneBoutique)}?text=${encodeURIComponent(messageReservation(d))}`;
}

export function lienAvertissementBoutique(telephone: string, titre: string, lienArticle: string): string {
  const message = `Bonjour, votre article « ${titre} » a fait l’objet de signalements sur OranPromo. Merci de vérifier son contenu et de le corriger si nécessaire. ${lienArticle}`;
  return `https://wa.me/${numeroWhatsApp(telephone)}?text=${encodeURIComponent(message)}`;
}

/** US-20.2 : poser une question à la boutique sur un article, sans passer commande. */
export function lienQuestionArticle(telephone: string, titre: string, lienArticle: string): string {
  const message = `Bonjour, j’ai une question sur « ${titre} » : ${lienArticle} (vu sur OranPromo)`;
  return `https://wa.me/${numeroWhatsApp(telephone)}?text=${encodeURIComponent(message)}`;
}

/** Contacter un client à propos de sa commande (espace boutique). */
export function lienContactClient(telephone: string, numeroCommande: number, boutique: string): string {
  const message = `Bonjour, ici ${boutique} au sujet de votre commande n° ${numeroCommande} sur OranPromo.`;
  return `https://wa.me/${numeroWhatsApp(telephone)}?text=${encodeURIComponent(message)}`;
}
