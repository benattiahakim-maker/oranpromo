import { formaterPrix } from "./prix";

export type DemandeReservation = {
  telephoneBoutique: string; // format international, ex. "+213 555 12 34 56"
  titre: string;
  taille: string | null; // null pour un article en taille unique
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
  const taille = d.taille ? `, taille ${d.taille}` : "";
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
