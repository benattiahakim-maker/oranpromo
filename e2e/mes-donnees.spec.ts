// US-34.4 (partie sans décision en attente) : « Mes données » dans le compte (FR, AR) et registre des acceptations pour
// l'admin. « Fermer mon compte » n'existe pas encore (durées de conservation à fixer : question 5 de US-34).
import { expect, test } from "@playwright/test";
import { creerBoutique, creerCompte, fermerBase, sql } from "./outils/donnees";
import { connecterClient, connecterEspace } from "./outils/parcours";

test.afterAll(fermerBase);

test("« Mes données » : numéro, accords, boutiques suivies (les siennes seulement), en arabe ; registre admin", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const boutique = await creerBoutique({ nom: `Boutique Nour ${Date.now().toString(36)}` });
  const autre = await creerBoutique({ nom: `Atelier Autre ${Date.now().toString(36)}` });
  const lina = await creerCompte({ nom: "Lina Amrani" });
  const sami = await creerCompte({ nom: "Sami Kaci" });
  const [{ version }] = await sql<{ version: string }>("select to_char(max(version), 'YYYY-MM-DD') as version from versions_documents where document = 'conditions'");
  await sql(`insert into acceptations (profil_id, document, version, contexte) values ($1, 'conditions', $2::date, 'inscription'), ($1, 'confidentialite',
    (select max(version) from versions_documents where document = 'confidentialite'), 'inscription')`, [lina.id, version]);
  await sql("insert into abonnements_boutique (profil_id, boutique_id, source) values ($1, $2, 'vitrine'), ($3, $4, 'vitrine')", [lina.id, boutique.id, sami.id, autre.id]);
  const [j, m, a] = version.split("-").map(Number);
  const versionAffichee = `${a}/${m}/${j}`;

  await test.step("/compte → « Mes données » : ce que BleDeal garde, avec les dates", async () => {
    await connecterClient(page, lina.email);
    await page.goto("/compte");
    await page.getByRole("link", { name: "Mes données" }).click();
    await expect(page).toHaveURL(/\/compte\/donnees$/);
    const d = page.getByRole("definition");
    await expect(page.getByRole("heading", { name: "Mes données" })).toBeVisible();
    await expect(d.filter({ hasText: lina.telephone })).toContainText(/vérifié le \d{1,2}\/\d{1,2}\/\d{4}/);
    await expect(d.filter({ hasText: "Lina Amrani" })).toHaveCount(1);
    await expect(page.getByText(new RegExp(`Conditions d’utilisation, version du ${versionAffichee} · accepté le \\d{1,2}/\\d{1,2}/\\d{4}`))).toBeVisible();
    await expect(page.getByText(/Politique de confidentialité, version du .* · accepté le/)).toBeVisible();
    await expect(page.getByText(new RegExp(`${boutique.nom} · depuis le \\d{1,2}/\\d{1,2}/\\d{4}`))).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(autre.nom); // jamais les données d'un autre compte
    await expect(page.getByRole("main")).not.toContainText("Sami");
    await expect(page.getByRole("link", { name: "politique de confidentialité" })).toHaveAttribute("href", "/confidentialite");
    await expect(page.getByText(/Fermer mon compte/)).toHaveCount(0);
  });

  await test.step("en arabe : « المعلومات نتاعي »", async () => {
    await page.goto("/villes");
    await page.getByRole("form", { name: "Langue" }).getByRole("button").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.goto("/compte/donnees");
    await expect(page.getByRole("heading", { name: "المعلومات نتاعي" })).toBeVisible();
    await expect(page.getByText(/شروط الاستعمال، النسخة تاع/)).toBeVisible();
  });

  await test.step("admin : nombre par version, puis recherche par numéro → accords du compte", async () => {
    const admin = await connecterEspace(browser, (await creerCompte({ role: "admin", nom: "Hakim" })).email);
    await admin.goto("/admin");
    await admin.getByRole("navigation", { name: "Administration" }).getByRole("link", { name: "Acceptations" }).click();
    await expect(admin.getByRole("heading", { name: "Acceptations" })).toBeVisible();
    const [{ n }] = await sql<{ n: string }>("select count(*) as n from acceptations where document = 'conditions' and version = $1::date", [version]);
    await expect(admin.getByRole("listitem").filter({ hasText: `Conditions d’utilisation · version du ${versionAffichee}` })).toContainText(Number(n).toLocaleString("fr-FR"));
    await admin.getByLabel("Numéro ou nom (3 caractères au moins)").fill(`0${lina.telephone.slice(4)}`);
    await admin.getByRole("button", { name: "Chercher" }).click();
    const compte = admin.getByRole("list", { name: "Comptes" }).getByRole("listitem").filter({ hasText: "Lina Amrani" }).first();
    await expect(compte).toContainText(`Conditions d’utilisation, version du ${versionAffichee} · accepté le`);
    await expect(compte).toContainText("à l’inscription");
    await admin.context().close();
  });
});

test("« Mes données » sans connexion : renvoi vers la connexion", async ({ page }) => {
  await page.goto("/compte/donnees");
  await expect(page).toHaveURL(/\/compte\/connexion\?suite=%2Fcompte%2Fdonnees$/);
});
