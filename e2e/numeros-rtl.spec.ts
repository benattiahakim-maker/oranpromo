// Numéros de téléphone dans une page en arabe (dir="rtl") : isolés de gauche à droite (<Numero />), le « + » reste au
// début et les chiffres dans l'ordre (BOLOSS, 10/10). Vérifié à l'écran : position du premier et du dernier caractère.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase } from "./outils/donnees";
import { commanderArticle, connecterClient, connecterEspace } from "./outils/parcours";

test.afterAll(fermerBase);

async function passerEnArabe(page: Page) {
  await page.goto("/villes");
  await page.getByRole("form", { name: "Langue" }).getByRole("button").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
}

/** Le numéro s'affiche dans l'ordre : premier caractère (« + » ou « 0 ») à gauche du dernier, en sens gauche-droite. */
async function verifierSens(numero: Locator, texte: string) {
  await expect(numero).toHaveText(texte);
  const sens = await numero.evaluate(el => {
    const noeud = el.firstChild as Text;
    const position = (debut: number) => { const r = document.createRange(); r.setStart(noeud, debut); r.setEnd(noeud, debut + 1); return r.getBoundingClientRect().left; };
    return { direction: getComputedStyle(el).direction, page: getComputedStyle(document.documentElement).direction, premierAGauche: position(0) < position(noeud.length - 1) };
  });
  expect(sens).toEqual({ direction: "ltr", page: "rtl", premierAGauche: true });
}

test("en arabe : numéros du compte, de « Mes données » et des commandes reçues dans l'espace, de gauche à droite", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const boutique = await creerBoutique();
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  const article = await creerArticle(boutique.id);
  const lina = await creerCompte({ nom: "Lina Amrani" });
  const lisible = `0${lina.telephone.slice(4, 7)} ${lina.telephone.slice(7, 9)} ${lina.telephone.slice(9, 11)} ${lina.telephone.slice(11)}`;

  await test.step("client : /compte et « Mes données »", async () => {
    await connecterClient(page, lina.email);
    await commanderArticle(page, article);
    await passerEnArabe(page);
    await page.goto("/compte");
    await verifierSens(page.locator("[data-numero]").first(), lisible);
    await page.goto("/compte/donnees");
    await expect(page.getByRole("heading", { name: "المعلومات نتاعي" })).toBeVisible();
    await verifierSens(page.getByRole("definition").locator("[data-numero]"), lina.telephone);
    // la ligne suit la page (de droite à gauche) : le numéro, au début de la phrase, est collé au bord droit
    const ligne = page.getByRole("definition").filter({ has: page.locator("[data-numero]") });
    await expect(ligne).toHaveCSS("direction", "rtl");
    const [numero, cadre] = [await ligne.locator("[data-numero]").boundingBox(), await ligne.boundingBox()];
    expect(Math.abs(numero!.x + numero!.width - (cadre!.x + cadre!.width))).toBeLessThan(2);
  });

  await test.step("commerçant : numéro du client dans « Commandes reçues », page en arabe", async () => {
    const espace = await connecterEspace(browser, marchand.email);
    await passerEnArabe(espace);
    await espace.goto("/espace/commandes?etape=a_confirmer");
    await espace.getByRole("button", { name: /رقم \d+ · Lina/ }).click(); // US-35 : espace en arabe
    await verifierSens(espace.locator("[data-numero]").filter({ hasText: lisible }).first(), lisible);
    await espace.context().close();
  });
});
