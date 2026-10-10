// Parrainage et bons (carte Trello, §1 « commande récupérée, bon de parrainage visible ») puis remboursement de la
// boutique par l'admin (US-27.5). Les règles ne sont pas réécrites ici : le test passe par les écrans.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, ouvrirParrainage, sql } from "./outils/donnees";
import { avancerCommande, commanderArticle, connecterClient, connecterEspace, lireJetonRetrait, remettre } from "./outils/parcours";

test.afterAll(fermerBase);

test("parrainage : premier retrait par QR code → un bon chacun → bon utilisé → relevé payé par l'admin", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await ouvrirParrainage();
  // Budget du mois très haut dans la base LOCALE : les tests relancés ne doivent pas l'épuiser (production : 30 000 DA).
  await sql("insert into prive.reglages (cle, valeur) values ('parrainage_budget_mois', '10000000') on conflict (cle) do update set valeur = excluded.valeur");
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id, { prix: 2500 });
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  const parrain = await creerCompte({ nom: "Samir" });
  const filleul = await creerCompte({ nom: "Lina" });
  const admin = await creerCompte({ role: "admin", nom: "Hakim" });

  const contexteParrain = await browser.newContext();
  const pageParrain = await contexteParrain.newPage();
  let code = "";
  await test.step("le parrain lit son code sur /parrainage", async () => {
    await connecterClient(pageParrain, parrain.email);
    await pageParrain.goto("/parrainage");
    await expect(pageParrain.getByRole("heading", { name: "Parraine tes amis" })).toBeVisible();
    code = (await pageParrain.getByText("Ton code").locator("xpath=..").locator("strong").innerText()).trim();
    expect(code).toMatch(/^[23456789A-Z]{6}$/);
  });

  await test.step("le filleul saisit le code dans /compte", async () => {
    await connecterClient(page, filleul.email);
    await page.goto("/compte");
    await page.getByLabel("Votre parrain (facultatif) : son numéro WhatsApp ou son code").fill(code); // /compte : vouvoiement
    await page.getByRole("button", { name: "Valider", exact: true }).click();
    await expect(page.getByText(/il deviendra votre parrain après votre premier retrait/)).toBeVisible();
    // /compte vouvoie partout (« Mon parrainage », « Mes bons », choix du parrain) ; /parrainage garde le tutoiement.
    await expect(page.getByRole("main")).not.toContainText(/\b(ton|ta|tes|tu|toi)\b/i);
    await expect(page.getByText("Parrain enregistré")).toBeVisible();
  });

  const espace = await connecterEspace(browser, marchand.email);
  await test.step("première commande (2 500 DA) remise par QR code", async () => {
    const suivi = await commanderArticle(page, article);
    await avancerCommande(espace, "a_confirmer", "Lina", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Lina", "Prête");
    await page.goto(suivi);
    await espace.goto(`/espace/retrait/${await lireJetonRetrait(page)}`);
    await remettre(espace, /^Commande n° \d+$/);
  });

  await test.step("un bon de 300 DA visible chez le filleul et chez le parrain", async () => {
    for (const p of [page, pageParrain]) {
      await p.goto("/compte");
      const bons = p.getByRole("region", { name: "Mes bons" });
      await expect(bons).toContainText("Bon parrainage");
      await expect(bons).toContainText("Disponible");
    }
  });

  await test.step("deuxième commande du filleul avec son bon : 2 200 DA à payer, remise par QR code", async () => {
    await page.goto(`/a/${article.id}`);
    await page.getByRole("button", { name: "Taille M" }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await expect(page.getByRole("checkbox", { name: /Utiliser mon bon parrainage/ })).toBeChecked();
    await expect(page.getByText("2 200 DA").first()).toBeVisible();
    await page.getByRole("button", { name: "Commander", exact: true }).click();
    await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
    const suivi = new URL(page.url()).pathname;
    await avancerCommande(espace, "a_confirmer", "Lina", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Lina", "Prête");
    await page.goto(suivi);
    await expect(page.getByText("2 200 DA").first()).toBeVisible();
    await espace.goto(`/espace/retrait/${await lireJetonRetrait(page)}`);
    await expect(espace.getByText("Bon parrainage BleDeal")).toBeVisible();
    await expect(espace.getByText("2 200 DA").first()).toBeVisible();
    await remettre(espace);
  });

  await test.step("l'admin voit le relevé de la boutique puis le marque payé", async () => {
    // La tâche planifiée du 1er du mois clôture les relevés (en_cours → a_payer) : simulée ici, base locale seulement.
    await sql("update releves_bons set statut = 'a_payer', cloture_le = now() where boutique_id = $1", [boutique.id]);
    const pageAdmin = await connecterEspace(browser, admin.email);
    await pageAdmin.goto("/admin/remboursements");
    await expect(pageAdmin.getByRole("heading", { name: "Remboursements" })).toBeVisible();
    await pageAdmin.getByRole("button", { name: `Marquer comme payé le relevé de ${boutique.nom}` }).click();
    await pageAdmin.getByLabel("Référence du paiement (obligatoire)").fill("CCP-E2E-001");
    await pageAdmin.getByRole("button", { name: "Marquer comme payé", exact: true }).click();
    await pageAdmin.getByRole("button", { name: "Confirmer", exact: true }).click();
    await expect(pageAdmin.getByText("réf. CCP-E2E-001")).toBeVisible();
    await pageAdmin.context().close();
  });
  await espace.context().close();
  await contexteParrain.close();
});
