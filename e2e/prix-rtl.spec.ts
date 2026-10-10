// Prix dans les pages en arabe (dir="rtl" sur tout le site ; espace en arabe depuis US-35) : isolés par <Prix />
// (BOLOSS, 10/10). Vérifié à l'écran, caractère par caractère : en français « DA » reste à droite du nombre et
// « − » à sa gauche ; en arabe « دج » est à gauche du nombre et les chiffres restent dans l'ordre.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql, unique } from "./outils/donnees";
import { avancerCommande, commanderOuAccepter, connecterClient, connecterEspace, lireJetonRetrait } from "./outils/parcours";

const code = `PRX${unique().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;
test.afterAll(async () => { await sql("update programmes_bons set actif = false where code = $1", [code]); await fermerBase(); });

async function passerEnArabe(page: Page) {
  await page.goto("/villes");
  await page.getByRole("form", { name: "Langue" }).getByRole("button").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
}

/** Position à l'écran (bord gauche) de chaque caractère utile du prix trouvé dans l'élément. */
async function positions(element: Locator, prix: RegExp) {
  return element.evaluate((el, source) => {
    const motif = new RegExp(source);
    const noeuds: Text[] = [];
    const parcours = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (parcours.nextNode()) noeuds.push(parcours.currentNode as Text);
    const caracteres = noeuds.flatMap(n => [...n.data].map((c, i) => ({ c, n, i })));
    const texte = caracteres.map(x => x.c).join("");
    const m = motif.exec(texte);
    if (!m) return null;
    return caracteres.slice(m.index, m.index + m[0].length).filter(x => /[0-9−A-Zدج]/.test(x.c)).map(({ c, n, i }) => {
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
      return { c, x: Math.round(r.getBoundingClientRect().left) };
    });
  }, prix.source);
}

/** Français : chaque caractère à droite du précédent (−, chiffres, D, A). */
async function francaisDansLOrdre(element: Locator, prix: RegExp) {
  const p = await positions(element, prix);
  expect(p, `prix ${prix} trouvé`).not.toBeNull();
  expect(p!.map(x => x.x), p!.map(x => x.c).join("")).toEqual([...p!.map(x => x.x)].sort((a, b) => a - b));
}

/** Arabe : chiffres dans l'ordre de gauche à droite, « دج » à gauche du nombre. */
async function arabeDansLOrdre(element: Locator, prix: RegExp) {
  const p = await positions(element, prix);
  expect(p, `prix ${prix} trouvé`).not.toBeNull();
  const chiffres = p!.filter(x => /[0-9−]/.test(x.c)).map(x => x.x);
  expect(chiffres).toEqual([...chiffres].sort((a, b) => a - b));
  const devise = p!.filter(x => /[دج]/.test(x.c)).map(x => x.x);
  expect(Math.max(...devise)).toBeLessThan(Math.min(...chiffres));
}

test("prix en arabe : suivi de commande avec bon (client) ; commande et retrait dans l'espace en arabe (US-35)", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await sql(`insert into programmes_bons (type, nom_fr, nom_ar, code, montant, minimum_achat, univers, villes, fin, budget, plafond_par_boutique, actif)
             values ('campagne', 'Aïd test', 'العيد', $1, 500, 4000, 'femme', '{oran}', now() + interval '10 days', 1000000, 30, true)`, [code]);
  const boutique = await creerBoutique();
  const robe = await creerArticle(boutique.id, { prix: 2500, titre: "Robe fleurie", categorie: "Robes", genre: "femme" });
  const client = await creerCompte({ nom: "Lina Amrani" });
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });

  await connecterClient(page, client.email);
  await page.goto("/compte");
  await page.getByRole("button", { name: "J’ai un code" }).click();
  await page.getByRole("textbox", { name: "J’ai un code" }).fill(code);
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ajouté" })).toBeVisible();
  await page.goto(`/a/${robe.id}`);
  await page.getByRole("button", { name: "Taille M" }).click();
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await page.goto("/panier");
  await page.getByRole("button", { name: /une pièce de plus/ }).click();
  await page.getByRole("button", { name: /une pièce de plus/ }).click();
  await expect(page.getByRole("checkbox", { name: /Utiliser mon bon Aïd test/ })).toBeChecked();
  await commanderOuAccepter(page);
  await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
  const suivi = new URL(page.url()).pathname;
  const espace = await connecterEspace(browser, marchand.email);
  await avancerCommande(espace, "a_confirmer", "Lina", "Confirmer");
  await avancerCommande(espace, "a_preparer", "Lina", "Prête");

  await test.step("client en arabe : total, bon « −500 دج » et reste à payer", async () => {
    await page.goto(suivi);
    const jeton = await lireJetonRetrait(page);
    await passerEnArabe(page);
    await page.goto(suivi);
    const main = page.getByRole("main");
    await arabeDansLOrdre(main, /7\s500\u2069?\s+دج/);
    await arabeDansLOrdre(main, /\u2066?−\u2066?500\u2069?\s+دج/);
    await arabeDansLOrdre(main, /7\s000\u2069?\s+دج/);

    await test.step("commerçant, espace en arabe (US-35) : retrait (sous-total, bon, à encaisser) avec « دج » à gauche", async () => {
      // d'abord en français (pas de régression) : « DA » à droite, « − » à gauche
      await espace.goto(`/espace/retrait/${jeton}`);
      await expect(espace.getByRole("main").getByText(/À encaisser en espèces/)).toBeVisible();
      await francaisDansLOrdre(espace.getByRole("main"), /7\s500\sDA/);
      await francaisDansLOrdre(espace.getByRole("main"), /−500\sDA/);
      await passerEnArabe(espace);
      await espace.goto(`/espace/retrait/${jeton}`);
      const contenu = espace.getByRole("main");
      await expect(contenu.getByText("تقبض كاش")).toBeVisible();
      await arabeDansLOrdre(contenu, /7\s500\u2069?\s+دج/);
      await arabeDansLOrdre(contenu, /\u2066?−\u2066?500\u2069?\s+دج/);
      await arabeDansLOrdre(contenu, /7\s000\u2069?\s+دج/);
      await expect(contenu).not.toContainText("DA");
      await espace.goto("/espace/commandes?etape=pretes");
      await espace.getByRole("button", { name: /رقم \d+ · Lina/ }).click();
      await arabeDansLOrdre(espace.getByRole("main"), /(?<=المجموع \u2066?)7\s500\u2069?\s+دج/);
      await espace.context().close();
    });
  });
});
