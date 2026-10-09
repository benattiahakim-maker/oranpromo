// US-20.5 : messages WhatsApp. Le fournisseur (Meta Cloud API aujourd'hui, Twilio plus tard) est interchangeable.

/** Message réservé dans la file d'attente `messages_whatsapp`, prêt à partir. */
export type MessageWhatsApp = {
  id: string;
  /** Jeton de réservation à rendre avec le résultat (sinon la base ignore le résultat). */
  reservation: string;
  /** Numéro international : +213XXXXXXXXX. */
  destinataire: string;
  /** Nom du modèle approuvé chez le fournisseur (ex. oranpromo_commande_prete). */
  modele: string;
  /** Valeurs {{1}}, {{2}}… du modèle, dans l'ordre. */
  parametres: string[];
  /** Version lisible du message (journal, fournisseurs sans modèle). */
  texte: string;
  /** Paramètre du bouton lien du modèle (US-20.6 : lien signé de « Confirmer »), ajouté au moment de l'envoi. */
  bouton?: string;
};

export type ResultatEnvoi =
  | { succes: true; identifiant: string | null }
  /** `definitif` : inutile de réessayer (numéro invalide, modèle refusé…). */
  | { succes: false; erreur: string; definitif: boolean };

export interface FournisseurWhatsApp {
  nom: string;
  envoyer(message: MessageWhatsApp): Promise<ResultatEnvoi>;
}
