// Connexion par le VRAI lien e-mail : le formulaire du site demande le lien à l'authentification locale, le message
// arrive dans Mailpit (boîte de test de la pile locale, rien ne part sur Internet), le test ouvre le lien.
import { expect, type Page } from "@playwright/test";
import { E2E } from "./env";

type Resume = { ID: string; To: { Address: string }[]; Created: string };

async function dernierLien(email: string, apres: number): Promise<string> {
  for (let essai = 0; essai < 40; essai++) {
    const reponse = await fetch(`${E2E.mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages = [] } = await reponse.json() as { messages?: Resume[] };
    const recent = messages.find(m => Date.parse(m.Created) >= apres - 2000);
    if (recent) {
      const message = await (await fetch(`${E2E.mailpit}/api/v1/message/${recent.ID}`)).json() as { Text?: string; HTML?: string };
      const lien = /(https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>]+)/.exec(`${message.Text ?? ""} ${message.HTML ?? ""}`)?.[1];
      if (lien) return lien.replace(/&amp;/g, "&");
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Aucun lien de connexion reçu pour ${email} dans Mailpit.`);
}

/** Libellés du formulaire de connexion par e-mail : français par défaut ; ARABE pour le parcours en arabe (US-23). */
export const LIBELLES_CONNEXION = {
  fr: { champ: /e-mail/i, bouton: /recevoir/i, envoye: /lien/i },
  ar: { champ: "الإيميل", bouton: "ابعثلي رابط الدخول", envoye: "رابط" },
} as const;

/** page = page de connexion (/espace/connexion ou /compte/connexion?suite=…) déjà ouverte. */
export async function seConnecterParEmail(page: Page, email: string, langue: keyof typeof LIBELLES_CONNEXION = "fr") {
  const l = LIBELLES_CONNEXION[langue];
  const depart = Date.now();
  await page.getByLabel(l.champ, { exact: langue === "ar" }).first().fill(email);
  await page.getByRole("button", { name: l.bouton }).click();
  await expect(page.getByRole("status")).toContainText(l.envoye);
  await page.goto(await dernierLien(email, depart));
}
