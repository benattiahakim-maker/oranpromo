// US-33.3 : bon de campagne avec code. La campagne est créée dans la base LOCALE (l'écran admin arrive avec US-33.5),
// puis fermée à la fin. Le test passe par les écrans : bandeau de l'accueil, conditions, « J'ai un code », panier.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql, unique } from "./outils/donnees";
import { commanderOuAccepter, connecterClient } from "./outils/parcours";

const code = `E2E${unique().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}`;
test.afterAll(async () => {
  await sql("update programmes_bons set actif = false where code = $1", [code]);
  await fermerBase();
});

test("bon de campagne : bandeau et conditions → code dans /compte → bon choisi au panier, raison des autres", async ({ page }) => {
  test.setTimeout(120_000);
  await sql(`insert into programmes_bons (type, nom_fr, nom_ar, code, montant, minimum_achat, univers, villes, fin, budget, plafond_par_boutique, actif)
             values ('campagne', 'Aïd test', 'العيد', $1, 500, 4000, 'femme', '{oran}', now() + interval '10 days', 1000000, 30, true)`, [code]);
  const boutique = await creerBoutique();
  const robe = await creerArticle(boutique.id, { prix: 2500, titre: "Robe Aïd", categorie: "Robes", genre: "femme" });
  const client = await creerCompte({ nom: "Yasmine" });

  await test.step("accueil d'Oran : bandeau (texte n° 14) et conditions de la campagne", async () => {
    await page.goto("/oran");
    const bandeau = page.getByRole("region", { name: "Conditions" });
    await expect(bandeau).toContainText(new RegExp(`Aïd test : 500\\sDA offerts dès 4\\s000\\sDA d’achat avec le code ${code}, jusqu’au \\d{1,2}/\\d{1,2}\\.`));
    await bandeau.getByRole("link", { name: "Conditions" }).first().click();
    await expect(page.getByRole("heading", { name: "Conditions du bon Aïd test" })).toBeVisible();
    await expect(page.getByText("Articles Femme seulement")).toBeVisible();
    await expect(page.getByText("Une fois par numéro vérifié.")).toBeVisible();
    await expect(page.getByText("Remise en boutique par QR code obligatoire.")).toBeVisible();
  });

  await test.step("« J'ai un code » : code faux, puis le bon code", async () => {
    await connecterClient(page, client.email);
    await page.goto("/compte");
    await page.getByRole("button", { name: "J’ai un code" }).click();
    await page.getByRole("textbox", { name: "J’ai un code" }).fill("FAUX0000");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ce code" })).toHaveText("Ce code n’existe pas ou n’est plus valable.");
    await page.getByRole("textbox", { name: "J’ai un code" }).fill(code.toLowerCase());
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("status").filter({ hasText: "ajouté" })).toHaveText(/^Bon Aïd test ajouté : 500\sDA dès 4\s000\sDA d’achat\.$/);
    await expect(page.getByRole("region", { name: "Mes bons" })).toContainText("Bon Aïd test");
  });

  await test.step("panier de 2 500 DA : « Dès 4 000 DA d'achat » ; 5 000 DA : bon posé, 4 500 DA à payer", async () => {
    await page.goto(`/a/${robe.id}`);
    await page.getByRole("button", { name: "Taille M" }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await expect(page.getByText(/Bon Aïd test · Dès 4\s000\sDA d’achat/)).toBeVisible();
    await page.getByRole("button", { name: "Robe Aïd M : une pièce de plus" }).click();
    await expect(page.getByRole("checkbox", { name: /Utiliser mon bon Aïd test \(−500\sDA\)/ })).toBeChecked();
    await expect(page.getByText("4 500 DA").first()).toBeVisible();
    await commanderOuAccepter(page);
    await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
    await expect(page.getByText("4 500 DA").first()).toBeVisible();
    const bons = await sql<{ statut: string }>("select b.statut from bons b join programmes_bons p on p.id = b.programme_id where p.code = $1", [code]);
    expect(bons).toEqual([{ statut: "reserve" }]);
  });
});
