// Revue RTL (BOLOSS, 10/10) : site en arabe (html dir="rtl").
// - L'espace commerçant et l'administration sont en français : ils restent de gauche à droite (dir="ltr" lang="fr"),
//   sinon les phrases se retournent (« jours 7 », « .Sur les 7 derniers jours ») et la navigation s'inverse.
// - Suivi d'une commande prête : l'adresse de la boutique (« 12 rue de Mostaganem ») garde son ordre.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase } from "./outils/donnees";
import { avancerCommande, commanderArticle, connecterClient, connecterEspace } from "./outils/parcours";

test.afterAll(fermerBase);

async function passerEnArabe(page: Page) {
  await page.goto("/villes");
  await page.getByRole("form", { name: "Langue" }).getByRole("button").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
}

/** Dans la navigation, le premier lien est à gauche du dernier (sens gauche-droite), le texte est en ltr. */
async function navigationGaucheDroite(nav: Locator) {
  const liens = nav.getByRole("link");
  await expect(liens.first()).toBeVisible();
  const [premier, dernier] = [await liens.first().boundingBox(), await liens.last().boundingBox()];
  await expect(nav).toHaveCSS("direction", "ltr");
  expect(premier!.y < dernier!.y || premier!.x < dernier!.x).toBe(true);
}

test("en arabe : espace et administration en ltr, adresse du suivi dans l'ordre", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const boutique = await creerBoutique();
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  const article = await creerArticle(boutique.id);
  const lina = await creerCompte({ nom: "Lina Amrani" });

  const espace = await connecterEspace(browser, marchand.email);
  await passerEnArabe(espace);
  await test.step("espace commerçant : français de gauche à droite", async () => {
    await espace.goto("/espace/statistiques");
    await expect(espace.locator("html")).toHaveAttribute("dir", "rtl");
    await navigationGaucheDroite(espace.getByRole("navigation", { name: "Espace commerçant" }));
    await expect(espace.locator('[dir="ltr"][lang="fr"]').first()).toBeAttached();
  });

  await test.step("client : adresse de la boutique dans le suivi d'une commande prête", async () => {
    await connecterClient(page, lina.email);
    const suivi = await commanderArticle(page, article);
    await avancerCommande(espace, "a_confirmer", "Lina", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Lina", "Prête");
    await passerEnArabe(page);
    await page.goto(suivi);
    const adresse = page.locator("[data-adresse]");
    await expect(adresse).toHaveText("12 rue de Mostaganem");
    const ordre = await adresse.evaluate(el => {
      const noeud = el.firstChild as Text;
      const gauche = (debut: number) => { const r = document.createRange(); r.setStart(noeud, debut); r.setEnd(noeud, debut + 1); return r.getBoundingClientRect().left; };
      return gauche(0) < gauche(noeud.length - 1); // « 1 » de « 12 » à gauche du « m » final
    });
    expect(ordre).toBe(true);
  });
  await espace.context().close();

  await test.step("administration : français de gauche à droite", async () => {
    const admin = await connecterEspace(browser, (await creerCompte({ role: "admin", nom: "Hakim" })).email);
    await passerEnArabe(admin);
    await admin.goto("/admin");
    await navigationGaucheDroite(admin.getByRole("navigation", { name: "Administration" }));
    await admin.context().close();
  });
});
