// US-33.2 : bon de bienvenue. Programme activé dans la base LOCALE seulement (en production : inactif, budget 0 DA,
// à activer par le propriétaire), puis remis à l'état de la migration à la fin. Le test passe par les écrans.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql } from "./outils/donnees";
import { avancerCommande, commanderOuAccepter, connecterClient, connecterEspace, lireJetonRetrait, remettre } from "./outils/parcours";

test.afterAll(async () => {
  await sql("update programmes_bons set actif = false, budget = 0 where type = 'bienvenue'");
  await fermerBase();
});

test("bon de bienvenue : numéro vérifié → bon dans « Mes bons » → utilisé dès 2 000 DA → relevé de la boutique", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await sql("update programmes_bons set actif = true, budget = 10000000 where type = 'bienvenue'");
  const boutique = await creerBoutique();
  const petit = await creerArticle(boutique.id, { prix: 1500, titre: "Foulard bienvenue" });
  const article = await creerArticle(boutique.id, { prix: 2500, titre: "Robe bienvenue" });
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  const client = await creerCompte({ nom: "Nadia" }); // numéro vérifié à la création → bon de bienvenue

  await test.step("« Mes bons » : Bon de bienvenue · 300 DA dès 2 000 DA d'achat", async () => {
    await connecterClient(page, client.email);
    await page.goto("/compte");
    const bons = page.getByRole("region", { name: "Mes bons" });
    await expect(bons).toContainText("Bon de bienvenue");
    await expect(bons).toContainText(/300\sDA dès 2\s000\sDA d’achat · jusqu’au \d{1,2}\/\d{1,2}/);
  });

  await test.step("panier de 1 500 DA : pas de case, le minimum est dit", async () => {
    await page.goto(`/a/${petit.id}`);
    await page.getByRole("button", { name: "Taille M" }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await expect(page.getByText(/Bon de bienvenue · Dès 2\s000\sDA d’achat/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Utiliser mon bon/ })).toHaveCount(0);
    await page.evaluate(() => localStorage.clear());
  });

  const espace = await connecterEspace(browser, marchand.email);
  await test.step("panier de 2 500 DA : bon posé, 2 200 DA à payer, remise par QR code", async () => {
    await page.goto(`/a/${article.id}`);
    await page.getByRole("button", { name: "Taille M" }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await expect(page.getByRole("checkbox", { name: /Utiliser mon bon de bienvenue \(−300\sDA\)/ })).toBeChecked();
    await expect(page.getByText("2 200 DA").first()).toBeVisible();
    await commanderOuAccepter(page);
    await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
    const suivi = new URL(page.url()).pathname;
    await avancerCommande(espace, "a_confirmer", "Nadia", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Nadia", "Prête");
    await page.goto(suivi);
    await expect(page.getByText("2 200 DA").first()).toBeVisible();
    await espace.goto(`/espace/retrait/${await lireJetonRetrait(page)}`);
    await remettre(espace);
  });

  await test.step("bon utilisé ; ligne du relevé avec l'origine « bienvenue »", async () => {
    await page.goto("/compte");
    await expect(page.getByRole("region", { name: "Mes bons" })).toContainText(/Utilisé le .* chez /);
    const lignes = await sql<{ origine: string; montant: number }>(
      "select l.origine, l.montant from lignes_releve l where l.boutique_id = $1", [boutique.id]);
    expect(lignes).toEqual([{ origine: "bienvenue", montant: 300 }]);
  });
  await espace.context().close();
});
