import type { FournisseurWhatsApp, MessageWhatsApp, ResultatEnvoi } from "./types";

// WhatsApp Cloud API (Meta) : envoi d'un message modèle.
// Les messages à l'initiative de l'entreprise doivent utiliser un modèle approuvé par Meta.
export type ReglagesMeta = { token: string; phoneNumberId: string; langue: string; version: string; fetch?: typeof fetch };

const DELAI_MS = 10_000;

export function corpsMessageMeta(message: MessageWhatsApp, langue: string) {
  return {
    messaging_product: "whatsapp",
    to: message.destinataire.replace(/^\+/, ""),
    type: "template",
    template: {
      name: message.modele,
      language: { code: langue },
      components: [
        ...(message.parametres.length ? [{ type: "body", parameters: message.parametres.map(text => ({ type: "text", text })) }] : []),
        // Bouton lien : la valeur est ajoutée à la fin de l'adresse enregistrée dans le modèle Meta (US-20.6).
        ...(message.bouton ? [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: message.bouton }] }] : []),
      ],
    },
  };
}

export function creerFournisseurMeta({ token, phoneNumberId, langue, version, fetch: requete = fetch }: ReglagesMeta): FournisseurWhatsApp {
  const url = `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneNumberId)}/messages`;
  return {
    nom: "meta",
    async envoyer(message): Promise<ResultatEnvoi> {
      let reponse: Response;
      try {
        reponse = await requete(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(corpsMessageMeta(message, langue)),
          signal: AbortSignal.timeout(DELAI_MS),
          cache: "no-store",
        });
      } catch {
        return { succes: false, erreur: "WhatsApp injoignable.", definitif: false };
      }
      const donnees = await reponse.json().catch(() => null) as { messages?: { id?: string }[]; error?: { message?: string; code?: number } } | null;
      if (reponse.ok) return { succes: true, identifiant: donnees?.messages?.[0]?.id ?? null };
      const detail = donnees?.error ? `${donnees.error.code ?? ""} ${donnees.error.message ?? ""}`.trim() : "";
      // 400 : requête refusée (numéro, modèle, paramètres) → inutile de réessayer. 401/403/429/5xx : on réessaie plus tard.
      return { succes: false, erreur: `Meta ${reponse.status}${detail ? ` : ${detail}` : ""}`.slice(0, 500), definitif: reponse.status === 400 };
    },
  };
}
