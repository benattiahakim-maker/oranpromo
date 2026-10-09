// US-21 : numéro de mobile algérien du client (vérifié par code) et mode de connexion des clients.
// Même règle que prive.telephone_client_valide() dans la base (migration 20261010090000_numero_verifie.sql).

/** +213 puis 5, 6 ou 7, puis 8 chiffres. */
export const FORMAT_TELEPHONE_CLIENT = /^\+213[567]\d{8}$/;
export const MESSAGE_TELEPHONE_INVALIDE = "Saisissez un numéro de mobile algérien : 05, 06 ou 07 suivi de 8 chiffres.";

export function telephoneClientValide(numero: string | null | undefined): boolean {
  return typeof numero === "string" && FORMAT_TELEPHONE_CLIENT.test(numero);
}

/**
 * Saisie libre → +213XXXXXXXXX, ou null si ce n'est pas un mobile algérien.
 * Acceptés : 0555 12 34 56, 555123456, +213 555 12 34 56, 00213…, 0213…, +2130555… ;
 * espaces, points, tirets et parenthèses ignorés.
 */
export function normaliserTelephoneClient(saisie: string | null | undefined): string | null {
  if (typeof saisie !== "string" || saisie.length > 40) return null;
  let chiffres = saisie.trim().replace(/[\s.\-()\u00a0]/g, "");
  if (chiffres.startsWith("+")) chiffres = chiffres.slice(1);
  else if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  if (!/^\d+$/.test(chiffres)) return null;
  if (chiffres.startsWith("0213")) chiffres = chiffres.slice(1);
  if (chiffres.startsWith("213")) chiffres = chiffres.slice(3);
  if (chiffres.length === 10 && chiffres.startsWith("0")) chiffres = chiffres.slice(1);
  const numero = `+213${chiffres}`;
  return telephoneClientValide(numero) ? numero : null;
}

export type ModeConnexionClient = "email" | "telephone";

/** CONNEXION_CLIENT (serveur) : « telephone » active la connexion par numéro, tout le reste = e-mail (par défaut). */
export function modeConnexionClient(valeur: string | undefined = process.env.CONNEXION_CLIENT): ModeConnexionClient {
  return valeur?.trim().toLowerCase() === "telephone" ? "telephone" : "email";
}

export type CanalCode = "whatsapp" | "sms";

export function canalCode(valeur: unknown): CanalCode {
  return valeur === "sms" ? "sms" : "whatsapp";
}

/** Code reçu : 6 chiffres exactement (espaces ignorés). */
export function nettoyerCode(saisie: string | null | undefined): string | null {
  if (typeof saisie !== "string") return null;
  const code = saisie.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}
