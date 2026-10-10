// US-31.2 : suivre une boutique depuis sa vitrine sans être connecté → connexion → retour suivi → « Mes boutiques »
// → ne plus suivre (avec confirmation). Base locale uniquement (voir docs/environnements.md).
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql } from "./outils/donnees";
import { seConnecterParEmail } from "./outils/connexion";

test.afterAll(fermerBase);

test("client : Suivre (déconnecté) → connexion → Suivie → Mes boutiques → ne plus suivre", async ({ page }) => {
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id);
  await sql(`insert into promos (article_id, prix_promo, date_fin) values ($1, 2500, now() + interval '3 days')`, [article.id]);
  const client = await creerCompte({ nom: "Amine" });

  await test.step("vitrine : « Suivre » renvoie à la connexion client puis revient suivie", async () => {
    await page.goto(`/b/${boutique.slug}`);
    await page.getByRole("button", { name: "Suivre", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/compte/connexion\\?suite=%2Fb%2F${boutique.slug}`));
    await seConnecterParEmail(page, client.email);
    await expect(page).toHaveURL(new RegExp(`/b/${boutique.slug}$`));
    await expect(page.getByRole("button", { name: "✓ Suivie" })).toBeVisible();
    const lignes = await sql(`select source from abonnements_boutique where profil_id = $1 and boutique_id = $2`, [client.id, boutique.id]);
    expect(lignes).toEqual([{ source: "vitrine" }]);
  });

  await test.step("/compte → Mes boutiques (1), promo en cours", async () => {
    await page.goto("/compte");
    await page.getByRole("link", { name: "Mes boutiques (1)" }).click();
    await expect(page).toHaveURL(/\/compte\/boutiques$/);
    const ligne = page.getByRole("link", { name: new RegExp(boutique.nom) });
    await expect(ligne).toContainText("1 promo en cours");
    await ligne.click();
    await expect(page).toHaveURL(new RegExp(`/b/${boutique.slug}$`));
  });

  await test.step("ne plus suivre, après confirmation", async () => {
    await page.getByRole("button", { name: "✓ Suivie" }).click();
    await expect(page.getByText(`Ne plus suivre ${boutique.nom} ?`)).toBeVisible();
    await page.getByRole("button", { name: "Garder" }).click();
    await expect(page.getByRole("button", { name: "✓ Suivie" })).toBeVisible();
    await page.getByRole("button", { name: "✓ Suivie" }).click();
    await page.getByRole("button", { name: "Ne plus suivre", exact: true }).click();
    await expect(page.getByRole("button", { name: "Suivre", exact: true })).toBeVisible();
    expect(await sql(`select 1 from abonnements_boutique where profil_id = $1`, [client.id])).toEqual([]);
    await page.goto("/compte/boutiques");
    await expect(page.getByText(/Vous ne suivez aucune boutique/)).toBeVisible();
  });
});

test("commerçant : pas de bouton « Suivre » sur une vitrine", async ({ page }) => {
  const boutique = await creerBoutique();
  const autre = await creerBoutique();
  const commercant = await creerCompte({ role: "commercant", boutique: autre.id });
  await page.goto("/espace/connexion");
  await seConnecterParEmail(page, commercant.email);
  await page.goto(`/b/${boutique.slug}`);
  await expect(page.getByRole("heading", { name: boutique.nom })).toBeVisible();
  await expect(page.getByRole("button", { name: /Suivre|Suivie/ })).toHaveCount(0);
});
