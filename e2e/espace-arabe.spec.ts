// US-35 : l'espace commerçant en arabe (textes à valider : docs/textes-espace-ar.md).
// Le commerçant choisit « عربي » dans la navigation de l'espace → tout l'espace passe en arabe, de droite à gauche
// (commandes, confirmation, préparation, retrait, articles, statistiques, avis, pied de page), puis revient au français.
// Échoue sur l'ancien code : pas de choix de langue dans l'espace, espace forcé en français (dir="ltr" lang="fr").
import { expect, test, type Page } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase } from "./outils/donnees";
import { commanderArticle, connecterEspace, lireJetonRetrait } from "./outils/parcours";

test.afterAll(fermerBase);

const ARABE = /[\u0600-\u06FF]/;

/** Dans « الطلبات اللي جاوك », ouvre la commande de Lina à l'étape donnée et appuie sur le bouton arabe. */
async function avancerEnArabe(espace: Page, etape: "a_confirmer" | "a_preparer", bouton: string) {
  await espace.goto(`/espace/commandes?etape=${etape}`);
  const ligne = espace.getByRole("button", { name: /^رقم \d+ · Lina\b/ });
  await ligne.click();
  await espace.getByRole("button", { name: bouton, exact: true }).click();
  await expect(ligne).toHaveCount(0);
}

test("espace commerçant en arabe : choix de la langue, commandes, retrait, articles, statistiques, avis, retour au français", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id);
  const lina = await creerCompte({ nom: "Lina Amrani" });
  const suivi = await commanderArticle(page, article, { email: lina.email });
  const espace = await connecterEspace(browser, (await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" })).email);

  await test.step("le commerçant choisit l'arabe dans la navigation de l'espace", async () => {
    await espace.goto("/espace");
    const nav = espace.getByRole("navigation", { name: "Espace commerçant" });
    await nav.getByRole("form", { name: "Langue" }).getByRole("button", { name: "العربية" }).click();
    await expect(espace.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(espace.locator("html")).toHaveAttribute("lang", "ar");
    const navArabe = espace.getByRole("navigation", { name: "فضاء التاجر" });
    await expect(navArabe.getByRole("link")).toHaveText(["السلع نتاعي", "الطلبات (1)", "الآراء", "زيد", "الإحصائيات"]);
    await expect(navArabe).toHaveCSS("direction", "rtl");
    // plus aucun bloc forcé en français sous l'espace (sauf le bloc des bons, absent ici)
    await expect(espace.locator('main[dir="ltr"], body > div[dir="ltr"]')).toHaveCount(0);
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText("السلع نتاعي");
    await expect(espace.getByRole("link", { name: "+ زيد سلعة" })).toBeVisible();
    // pied de page : suit la page (arabe)
    await expect(espace.getByRole("navigation", { name: "معلومات قانونية" }).getByRole("link").first()).toHaveText("الشروط");
  });

  await test.step("commandes : étapes, confirmation et « واجدة » en arabe, prix en « دج »", async () => {
    await espace.goto("/espace/commandes");
    await expect(espace).toHaveTitle(/الطلبات اللي جاوك/);
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText("الطلبات اللي جاوك");
    const etapes = espace.getByRole("navigation", { name: /المراحل/ });
    await expect(etapes).toContainText("باش تأكّد");
    await expect(espace.getByRole("main")).toContainText("دج");
    await expect(espace.getByRole("main")).not.toContainText(/\bDA\b|Commandes reçues|À confirmer/);
    await avancerEnArabe(espace, "a_confirmer", "أكّد");
    await espace.goto("/espace/commandes/preparation");
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText("ليستة التوجاد");
    await expect(espace.getByRole("main")).toContainText(article.titre);
    await avancerEnArabe(espace, "a_preparer", "واجدة");
  });

  await test.step("retrait par QR code en arabe : « تقبض كاش », « تسلّم للزبون » → « الطلب تسلّم »", async () => {
    await page.goto(suivi);
    const jeton = await lireJetonRetrait(page);
    await espace.goto(`/espace/retrait/${jeton}`);
    const contenu = espace.getByRole("main");
    await expect(contenu.getByText("تقبض كاش")).toBeVisible();
    await expect(contenu).toContainText("Lina");
    await espace.getByRole("button", { name: "تسلّم للزبون" }).click();
    await expect(espace.getByRole("status").filter({ hasText: "الطلب تسلّم" })).toBeVisible();
  });

  await test.step("articles, statistiques, avis, scanner : en arabe", async () => {
    await espace.goto(`/espace/articles/${article.id}`);
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText(/بدّل السلعة/);
    await expect(espace.getByRole("button", { name: "سجّل", exact: true })).toBeVisible();
    await espace.goto("/espace/articles/nouveau");
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText("سلعة جديدة");
    await expect(espace.getByText("العنوان *")).toBeVisible();
    await espace.goto("/espace/statistiques");
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText("الإحصائيات نتاعي");
    await expect(espace.getByRole("link", { name: "7 يوم" })).toBeVisible();
    await espace.goto("/espace/avis");
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText("الآراء");
    await espace.goto("/espace/scanner");
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText(ARABE);
    await expect(espace.getByRole("main")).not.toContainText("Scanner le QR code du client");
  });

  await test.step("retour au français depuis l'espace : tout redevient français, de gauche à droite", async () => {
    await espace.goto("/espace");
    await espace.getByRole("navigation", { name: "فضاء التاجر" }).getByRole("button", { name: "Français" }).click();
    await expect(espace.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(espace.getByRole("navigation", { name: "Espace commerçant" }).getByRole("link").first()).toHaveText("Mes articles");
    await expect(espace.getByRole("heading", { level: 1 })).toHaveText("Mes articles");
  });
  await espace.context().close();
});
