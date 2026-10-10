// Gestes répétés d'un parcours à l'autre (client qui commande, boutique qui avance une commande, retrait).
// Les libellés sont ceux que voit l'utilisateur : si un texte change, le test le dit.
import { expect, type Browser, type Page } from "@playwright/test";
import { seConnecterParEmail } from "./connexion";
import type { Article } from "./donnees";

/** Fiche → taille → panier → (connexion) → « Commander ». Renvoie l'adresse du suivi de la commande. */
export async function commanderArticle(page: Page, article: Article, options: { taille?: string; email?: string } = {}): Promise<string> {
  await page.goto(`/a/${article.id}`);
  await expect(page.getByRole("heading", { level: 1, name: article.titre })).toBeVisible();
  await page.getByRole("button", { name: `Taille ${options.taille ?? "M"}` }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ajouté au panier." })).toBeVisible();
  await page.getByRole("link", { name: "Voir le panier" }).click();
  await expect(page.getByRole("heading", { name: "Mon panier" })).toBeVisible();
  const connexion = page.getByRole("link", { name: "Se connecter pour commander" });
  if (options.email && await connexion.isVisible()) {
    await connexion.click();
    await seConnecterParEmail(page, options.email);
    await expect(page).toHaveURL(/\/panier/);
  }
  await commanderOuAccepter(page);
  await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
  await expect(page.getByText("Commande envoyée").first()).toBeVisible();
  return new URL(page.url()).pathname;
}

/** US-34.2 : au panier, « Commander » ; ou, si les conditions sont à accepter (compte créé par e-mail, nouvelle
 *  version), case cochée puis « Accepter et commander ». */
export async function commanderOuAccepter(page: Page) {
  const commander = page.getByRole("button", { name: "Commander", exact: true });
  const accepter = page.getByRole("button", { name: "Accepter et commander" });
  await expect(commander.or(accepter)).toBeVisible();
  if (await accepter.isVisible()) {
    await page.getByRole("checkbox", { name: /J’accepte les conditions d’utilisation/ }).check();
    await accepter.click();
  } else await commander.click();
}

/** US-34.3 : à la première visite de l'espace, le commerçant accepte les conditions commerçants. */
export async function accepterConditionsCommercant(page: Page) {
  await page.getByRole("checkbox", { name: /J’ai lu et j’accepte les conditions commerçants/ }).check();
  await page.getByRole("button", { name: "Accepter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Conditions commerçants" })).toHaveCount(0);
}

/** Nouvel onglet « navigation privée » : le commerçant (ou l'admin) se connecte sur son propre téléphone. */
export async function connecterEspace(browser: Browser, email: string): Promise<Page> {
  const contexte = await browser.newContext();
  const page = await contexte.newPage();
  await page.goto("/espace/connexion");
  await seConnecterParEmail(page, email);
  await expect(page).toHaveURL(/\/espace/);
  // US-34.3 : un commerçant qui n'a pas encore accepté les conditions les accepte d'abord (admin : rien à accepter).
  const demande = page.getByRole("heading", { name: "Conditions commerçants" });
  const espaceOuvert = page.getByRole("navigation", { name: "Espace commerçant" });
  await expect(espaceOuvert).toBeVisible();
  if (await demande.isVisible()) await accepterConditionsCommercant(page);
  return page;
}

/** Dans « Commandes reçues », ouvre la commande du client à l'étape donnée et appuie sur le bouton (« Confirmer », « Prête »). */
export async function avancerCommande(page: Page, etape: "a_confirmer" | "a_preparer", client: string, bouton: "Confirmer" | "Prête") {
  await page.goto(`/espace/commandes?etape=${etape}`);
  const ligne = page.getByRole("button", { name: new RegExp(`^N° \\d+ · ${client}\\b`) });
  await ligne.click();
  await page.getByRole("button", { name: bouton, exact: true }).click();
  await expect(ligne).toHaveCount(0);
}

/** Côté client, commande prête : code à 6 chiffres affiché sous le QR code. */
export async function lireCodeRetrait(page: Page): Promise<string> {
  const code = (await page.getByLabel("Code de retrait", { exact: true }).innerText()).replace(/\D/g, "");
  expect(code).toMatch(/^\d{6}$/);
  return code;
}

/** Côté client, commande prête : jeton du QR code (le même que dans le lien « Envoyer à un proche »). Le QR code
 *  contient ce lien ; la boutique qui le scanne arrive sur /espace/retrait/<jeton>. Une caméra ne se simule pas
 *  simplement dans un navigateur de test : on ouvre directement l'adresse que le scanner ouvrirait. */
export async function lireJetonRetrait(page: Page): Promise<string> {
  const href = await page.getByRole("link", { name: "Envoyer à un proche (WhatsApp)" }).getAttribute("href");
  const jeton = /%2Fretrait%2F([A-Za-z0-9_-]+)/.exec(href ?? "")?.[1];
  expect(jeton, "jeton dans le lien de partage").toBeTruthy();
  return jeton!;
}

/** Boutique : « Remis au client » sur la fiche de retrait ouverte (par le QR code ou par le code). */
export async function remettre(page: Page, numeroAttendu?: RegExp) {
  if (numeroAttendu) await expect(page.getByRole("region", { name: numeroAttendu })).toBeVisible();
  await page.getByRole("button", { name: "Remis au client" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Commande remise" })).toBeVisible();
}

/** Client : connexion par le lien e-mail depuis /compte/connexion (sans passer par le panier). */
export async function connecterClient(page: Page, email: string) {
  await page.goto("/compte/connexion");
  await seConnecterParEmail(page, email);
  await expect(page).toHaveURL(/\/compte/);
}
