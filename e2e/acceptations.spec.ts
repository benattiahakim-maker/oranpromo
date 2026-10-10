// US-34.2 et US-34.3 : acceptation datée des conditions. Client créé par e-mail (sans case à l'inscription) : la case
// apparaît au panier ; commerçant : l'espace demande l'accord à la première visite. Tout passe par les écrans.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql } from "./outils/donnees";
import { accepterConditionsCommercant, connecterClient } from "./outils/parcours";
import { seConnecterParEmail } from "./outils/connexion";

test.afterAll(fermerBase);

test("client : « Accepter et commander » au panier, accord enregistré, plus demandé ensuite", async ({ page }) => {
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id, { prix: 2500 });
  const client = await creerCompte({ nom: "Nadia" });
  await connecterClient(page, client.email);
  await page.goto(`/a/${article.id}`);
  await page.getByRole("button", { name: "Taille M" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.goto("/panier");
  await expect(page.getByText("Nos conditions ont changé le 10/10/2026")).toBeVisible();
  await expect(page.getByRole("button", { name: "Commander", exact: true })).toHaveCount(0);
  const accepter = page.getByRole("button", { name: "Accepter et commander" });
  await expect(accepter).toBeDisabled();
  await page.getByRole("checkbox", { name: /J’accepte les conditions d’utilisation/ }).check();
  await accepter.click();
  await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
  const lignes = await sql<{ document: string; contexte: string }>("select document, contexte from acceptations where profil_id = $1 order by document", [client.id]);
  expect(lignes).toEqual([{ document: "conditions", contexte: "commande" }, { document: "confidentialite", contexte: "commande" }]);
  await page.goto(`/a/${article.id}`);
  await page.getByRole("button", { name: "Taille M" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.goto("/panier");
  await expect(page.getByRole("button", { name: "Commander", exact: true })).toBeVisible();
});

test("commerçant : espace fermé jusqu'à l'accord (résumé, case, « Accepter »), puis ouvert", async ({ browser }) => {
  const boutique = await creerBoutique();
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Yacine" });
  const page = await (await browser.newContext()).newPage();
  await page.goto("/espace/connexion");
  await seConnecterParEmail(page, marchand.email);
  await expect(page.getByRole("heading", { name: "Conditions commerçants" })).toBeVisible();
  await expect(page.getByText("BleDeal ne vend rien et n’encaisse rien", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accepter", exact: true })).toBeDisabled();
  await page.goto("/espace/statistiques");
  await expect(page.getByRole("heading", { name: "Conditions commerçants" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await accepterConditionsCommercant(page);
  await page.goto("/espace");
  await expect(page.getByRole("heading", { name: "Conditions commerçants" })).toHaveCount(0);
  const lignes = await sql<{ document: string; contexte: string }>("select document, contexte from acceptations where profil_id = $1 order by document", [marchand.id]);
  expect(lignes).toEqual([{ document: "conditions_commercants", contexte: "espace" }, { document: "confidentialite", contexte: "espace" }]);
});
