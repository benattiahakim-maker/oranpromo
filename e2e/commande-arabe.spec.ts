// Commande complète en arabe (US-23), de droite à gauche : fiche → taille → panier → connexion par lien e-mail →
// « اطلب » → suivi → QR code de retrait → remise par QR code → « الطلب تدّا ». Libellés tirés de lib/textes/ar.ts.
// L'espace commerçant reste en français (décision 4 de US-26) : la boutique a son propre navigateur, en français.
import { expect, test, type Page } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql } from "./outils/donnees";
import { seConnecterParEmail } from "./outils/connexion";
import { avancerCommande, connecterEspace, lireCodeRetrait, lireJetonRetrait, remettre } from "./outils/parcours";

test.afterAll(fermerBase);

async function enArabe(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
}

test("client en arabe : commande complète jusqu'au retrait par QR code", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id);
  const client = await creerCompte({ nom: "Amine" });

  await test.step("passer le site en arabe", async () => {
    await page.goto("/villes");
    await page.getByRole("form", { name: "Langue" }).getByRole("button", { name: "العربية" }).click();
    await enArabe(page);
  });

  await test.step("fiche en arabe : prix en دج, مقاس M, زيد للسلة", async () => {
    await page.goto(`/a/${article.id}`);
    await enArabe(page);
    await expect(page.getByRole("heading", { level: 1, name: article.titre })).toBeVisible();
    // « 3 500 دج » : espaces insécables et marques d'isolement du sens de lecture (lib/prix.ts) autour du nombre.
    await expect(page.getByText(/3\s?500\W{0,3}دج/).first()).toBeVisible();
    await page.getByRole("button", { name: "مقاس M" }).click();
    await page.getByRole("button", { name: "زيد للسلة" }).click();
    await expect(page.getByRole("status").filter({ hasText: "تزادت للسلة." })).toBeVisible();
    await page.getByRole("link", { name: "شوف السلة" }).click();
  });

  await test.step("panier, connexion par lien e-mail en arabe, conditions acceptées en arabe, « نقبل ونطلب »", async () => {
    await expect(page.getByRole("heading", { name: "السلة ديالي" })).toBeVisible();
    await enArabe(page);
    await page.getByRole("link", { name: "ادخل لحسابك باش تطلب" }).click();
    await enArabe(page);
    await seConnecterParEmail(page, client.email, "ar");
    await expect(page).toHaveURL(/\/panier/);
    await enArabe(page);
    // Compte créé par e-mail (sans case à l'inscription) : au panier, les conditions sont à accepter (US-34.2), en arabe.
    await expect(page.getByText(/الشروط نتاعنا تبدلو نهار/)).toBeVisible();
    await expect(page.getByRole("button", { name: "اطلب", exact: true })).toHaveCount(0);
    await page.getByRole("checkbox", { name: /نقبل شروط الاستعمال/ }).check();
    await page.getByRole("button", { name: "نقبل ونطلب" }).click();
    await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
    await expect(page.getByText("الطلب تبعث").first()).toBeVisible();
    await expect(page.getByRole("list", { name: "تتبّع الطلب" })).toContainText("تأكّد (من بعد)");
  });
  const suivi = new URL(page.url()).pathname;
  const id = suivi.split("/").pop();

  await test.step("la commande garde la langue arabe (messages WhatsApp au client en arabe)", async () => {
    const [c] = await sql<{ langue: string }>("select langue from commandes where id = $1", [id]);
    expect(c.langue).toBe("ar");
  });

  const espace = await connecterEspace(browser, (await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" })).email);
  await test.step("la boutique (en français) confirme puis passe la commande prête", async () => {
    await expect(espace.locator("html")).toHaveAttribute("dir", "ltr");
    await avancerCommande(espace, "a_confirmer", "Amine", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Amine", "Prête");
  });

  let jeton = "";
  await test.step("le client voit son QR code de retrait et son code à 6 chiffres, en arabe", async () => {
    await page.goto(suivi);
    await enArabe(page);
    await expect(page.getByRole("heading", { name: "طلبك راهو واجد" })).toBeVisible();
    await expect(page.getByRole("region", { name: "QR تاع الاستلام" })).toBeVisible();
    await expect(page.getByRole("img", { name: /QR تاع الاستلام، الطلبية رقم \d+/ })).toBeVisible();
    await expect(page.getByText("ما خدمتش الكاميرا؟ عطيه هاد الرقم تاع 6 أرقام:")).toBeVisible();
    await lireCodeRetrait(page, "رقم الاستلام");
    jeton = await lireJetonRetrait(page, "ابعثو لواحد من دارك (واتساب)");
  });

  await test.step("la boutique scanne le QR code (lien du scanner) et remet la commande", async () => {
    await espace.goto(`/espace/retrait/${jeton}`);
    await remettre(espace, /^Commande n° \d+$/);
  });

  await test.step("le client voit « الطلب تدّا », toujours de droite à gauche", async () => {
    await page.reload();
    await enArabe(page);
    const frise = page.getByRole("list", { name: "تتبّع الطلب" });
    await expect(frise).toContainText("تدّا");
    await expect(frise).not.toContainText("تدّا (من بعد)");
    const [c] = await sql<{ statut: string; mode_remise: string }>("select statut, mode_remise from commandes where id = $1", [id]);
    expect(c).toEqual({ statut: "recuperee", mode_remise: "qr" });
  });
  await espace.context().close();
});
