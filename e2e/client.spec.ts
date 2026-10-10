// Parcours client (carte Trello « Tests · Parcours automatiques », §1) : choisir sa ville, chercher, fiche, taille,
// panier, connexion, commande, suivi ; puis la même entrée en arabe (de droite à gauche).
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, unique } from "./outils/donnees";
import { commanderArticle } from "./outils/parcours";

test.afterAll(fermerBase);

test("client : ville → recherche → fiche → taille → panier → commande → suivi", async ({ page }) => {
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id, { titre: `Polo lin ${unique()}` });
  const client = await creerCompte({ nom: "Amine" });

  await test.step("choisir sa ville", async () => {
    await page.goto("/villes");
    await expect(page.getByRole("heading", { name: "Choisissez votre ville" })).toBeVisible();
    await page.getByRole("list", { name: "Villes" }).getByRole("button", { name: /^Oran/ }).click();
    await expect(page).toHaveURL(/\/oran$/);
  });

  await test.step("chercher l'article et ouvrir sa fiche", async () => {
    await page.goto("/oran/catalogue");
    await page.getByRole("searchbox", { name: "Rechercher un article" }).fill(article.titre);
    await page.getByRole("searchbox", { name: "Rechercher un article" }).press("Enter");
    await expect(page).toHaveURL(/q=/);
    await page.getByRole("link", { name: new RegExp(article.titre) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/a/${article.id}`));
    await expect(page.getByText("3 500 DA").first()).toBeVisible();
  });

  let suivi = "";
  await test.step("taille, panier, connexion par lien e-mail, commande", async () => {
    suivi = await commanderArticle(page, article, { email: client.email });
  });

  await test.step("suivi de la commande", async () => {
    await expect(page.getByText(`Commande n° `).first()).toContainText(boutique.nom);
    const frise = page.getByRole("list", { name: "Suivi de la commande" });
    await expect(frise).toContainText("Demandée");
    await expect(frise).toContainText("Confirmée (à venir)");
    await page.goto("/compte/commandes");
    await expect(page.locator(`a[href="${suivi}"]`).first()).toBeVisible();
  });
});

test("client en arabe : la page passe de droite à gauche", async ({ page }) => {
  await page.goto("/villes");
  await page.getByRole("form", { name: "Langue" }).getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/[\u0600-\u06FF]/);
  // Retour au français (le sélecteur est alors écrit en arabe : « اللغة », bouton « Français »).
  await page.getByRole("form", { name: "اللغة" }).getByRole("button", { name: "Français" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
