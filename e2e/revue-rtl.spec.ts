// Revue RTL (BOLOSS, 10/10) : site en arabe (html dir="rtl").
// - L'administration est en français : elle reste de gauche à droite (dir="ltr" lang="fr"),
//   sinon les phrases se retournent (« jours 7 », « .Sur les 7 derniers jours ») et la navigation s'inverse.
// - US-35 : l'espace commerçant est traduit en arabe : il suit la page (droite à gauche), pied de page en arabe compris.
// - Le pied de page suit la page : français et de gauche à droite sous l'administration (BOLOSS, 10/10, point 1).
// - Suivi d'une commande prête : l'adresse de la boutique (« 12 rue de Mostaganem ») garde son ordre, sur sa propre ligne.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase } from "./outils/donnees";
import { commanderArticle, connecterClient, connecterEspace } from "./outils/parcours";

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

/** Pied de page en français et en ltr : « Conditions » à gauche de « Confidentialité ». */
async function piedEnFrancais(page: Page) {
  const pied = page.getByRole("navigation", { name: "Informations juridiques" });
  await expect(pied.getByRole("link")).toHaveText(["Conditions", "Commerçants", "Confidentialité"]);
  await expect(pied).toHaveCSS("direction", "ltr");
  const [premier, dernier] = [await pied.getByRole("link").first().boundingBox(), await pied.getByRole("link").last().boundingBox()];
  expect(premier!.x).toBeLessThan(dernier!.x);
}

test("en arabe : espace en arabe (rtl), administration en ltr, adresse du suivi dans l'ordre", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const boutique = await creerBoutique();
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  const article = await creerArticle(boutique.id);
  const lina = await creerCompte({ nom: "Lina Amrani" });

  const espace = await connecterEspace(browser, marchand.email);
  await passerEnArabe(espace);
  await test.step("espace commerçant (US-35) : arabe, de droite à gauche, pied de page en arabe", async () => {
    await espace.goto("/espace/statistiques");
    await expect(espace.locator("html")).toHaveAttribute("dir", "rtl");
    const nav = espace.getByRole("navigation", { name: "فضاء التاجر" });
    await expect(nav).toHaveCSS("direction", "rtl");
    const [premier, second] = [await nav.getByRole("link").nth(0).boundingBox(), await nav.getByRole("link").nth(1).boundingBox()];
    expect(premier!.x).toBeGreaterThan(second!.x); // « السلع نتاعي » à droite de « الطلبات »
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText("الإحصائيات نتاعي");
    await expect(espace.getByRole("main")).not.toContainText("Mes statistiques");
    const pied = espace.getByRole("navigation", { name: "معلومات قانونية" });
    await expect(pied.getByRole("link").first()).toHaveText("الشروط");
    await expect(pied).toHaveCSS("direction", "rtl");
  });

  await test.step("client : adresse de la boutique dans le suivi d'une commande prête", async () => {
    await connecterClient(page, lina.email);
    const suivi = await commanderArticle(page, article);
    // l'espace est en arabe (US-35) : « أكّد » puis « واجدة »
    for (const [etape, bouton] of [["a_confirmer", "أكّد"], ["a_preparer", "واجدة"]]) {
      await espace.goto(`/espace/commandes?etape=${etape}`);
      const ligne = espace.getByRole("button", { name: /^رقم \d+ · Lina\b/ });
      await ligne.click();
      await espace.getByRole("button", { name: bouton, exact: true }).click();
      await expect(ligne).toHaveCount(0);
    }
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
    // sur sa propre ligne, sous la date limite (l'adresse commence au début d'une ligne)
    const [date, ligneAdresse] = [await page.locator("p", { has: adresse }).locator("strong").boundingBox(), await adresse.boundingBox()];
    expect(ligneAdresse!.y).toBeGreaterThanOrEqual(date!.y + date!.height - 1);
    // côté client, le pied de page reste en arabe
    const pied = page.getByRole("navigation", { name: "معلومات قانونية" });
    await expect(pied.getByRole("link").first()).toHaveText("الشروط");
    await expect(pied).toHaveCSS("direction", "rtl");
  });
  await espace.context().close();

  await test.step("administration : français de gauche à droite", async () => {
    const admin = await connecterEspace(browser, (await creerCompte({ role: "admin", nom: "Hakim" })).email);
    await passerEnArabe(admin);
    await admin.goto("/admin");
    await navigationGaucheDroite(admin.getByRole("navigation", { name: "Administration" }));
    await piedEnFrancais(admin);
    await admin.context().close();
  });
});
