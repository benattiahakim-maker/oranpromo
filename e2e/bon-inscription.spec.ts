// US-31.4 : bon de bienvenue de l'inscription en boutique. Programme activé dans la base LOCALE seulement (en production :
// inactif, budget 0 DA, à activer par le propriétaire), puis remis à l'état de la migration à la fin.
// Affiche → bandeau avec le bon → compte → numéro vérifié → bon dans « Mes bons » → pas le jour même dans la boutique
// d'origine → le lendemain : posé, remis par QR code → relevé de 250 DA (500 − part de la boutique).
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql, telephone, unique } from "./outils/donnees";
import { seConnecterParEmail } from "./outils/connexion";
import { avancerCommande, commanderOuAccepter, connecterEspace, lireJetonRetrait, remettre } from "./outils/parcours";

test.afterAll(async () => {
  await sql("update programmes_bons set actif = false, budget = 0 where type = 'inscription_boutique'");
  await fermerBase();
});

test("US-31.4 : affiche → bon de bienvenue → dès demain dans la boutique → relevé moins la part de la boutique", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await sql("update programmes_bons set actif = true, budget = 10000000 where type = 'inscription_boutique'");
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id, { prix: 4500, titre: "Parfum inscription" });
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  const email = `inscrit-${unique()}@bledeal.test`;

  await test.step("affiche : bandeau avec le bon de bienvenue", async () => {
    await page.goto(`/i/${boutique.slug}`);
    await expect(page.getByText("Bon de bienvenue de 500 DA dès 4 000 DA d’achat, utilisable dès demain dans cette boutique, tout de suite ailleurs.")).toBeVisible();
  });

  await test.step("Créer mon compte → retour : « Vérifiez votre numéro… »", async () => {
    await page.getByRole("link", { name: "Créer mon compte" }).click();
    await seConnecterParEmail(page, email);
    await expect(page).toHaveURL(new RegExp(`/b/${boutique.slug}$`));
    await expect(page.getByText("Vérifiez votre numéro dans votre compte pour recevoir votre bon de bienvenue.")).toBeVisible();
  });

  await test.step("numéro vérifié → « Mes bons » : Bon de bienvenue, dès demain chez la boutique", async () => {
    // La vérification par code WhatsApp n'est pas simulée ici (couverte ailleurs) : le numéro est vérifié en base locale.
    await sql(`update profils p set nom = 'Lina', telephone = $2, telephone_verifie_le = now() from auth.users u where u.id = p.id and u.email = $1`, [email, telephone()]);
    await page.goto("/compte");
    const bons = page.getByRole("region", { name: "Mes bons" });
    await expect(bons).toContainText("Bon de bienvenue");
    await expect(bons).toContainText(/500\sDA dès 4\s000\sDA d’achat/);
    await expect(bons).toContainText(new RegExp(`Chez ${boutique.nom} : dès le \\d{1,2}/\\d{1,2}\\. Ailleurs : tout de suite\\.`));
    // Qui paie (BOLOSS du 10/10) : BleDeal et la boutique d'inscription.
    await expect(bons).toContainText(/Bon de bienvenue : \d[\d\s]*\sDA de moins, payé par BleDeal et la boutique où vous vous êtes inscrit\./);
  });

  await test.step("panier dans la boutique d'origine le jour même : « Dans cette boutique, dès demain », pas de case", async () => {
    await page.goto(`/a/${article.id}`);
    await page.getByRole("button", { name: "Taille M" }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await expect(page.getByText(/Bon de bienvenue · Dans cette boutique, dès demain/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Utiliser mon bon/ })).toHaveCount(0);
  });

  const espace = await connecterEspace(browser, marchand.email);
  await test.step("le lendemain : bon posé (4 000 DA à payer), remis par QR code", async () => {
    await sql(`update bons b set utilisable_des = now() - interval '1 second' from auth.users u where u.id = b.profil_id and u.email = $1 and b.origine = 'inscription_boutique'`, [email]);
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /Utiliser mon bon de bienvenue \(−500\sDA\)/ })).toBeChecked();
    await commanderOuAccepter(page);
    await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
    const suivi = new URL(page.url()).pathname;
    await avancerCommande(espace, "a_confirmer", "Lina", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Lina", "Prête");
    await page.goto(suivi);
    await expect(page.getByText("4 000 DA").first()).toBeVisible();
    await espace.goto(`/espace/retrait/${await lireJetonRetrait(page)}`);
    await remettre(espace);
  });

  await test.step("relevé : 250 DA à rembourser (500 − part de la boutique) ; espace : 1 inscrit en boutique", async () => {
    expect(await sql("select l.origine, l.montant, l.part_boutique from lignes_releve l where l.boutique_id = $1", [boutique.id]))
      .toEqual([{ origine: "inscription_boutique", montant: 500, part_boutique: 250 }]);
    await espace.goto("/espace");
    await expect(espace.getByText("1 client suit votre boutique · +1 cette semaine · dont 1 inscrit en boutique")).toBeVisible();
    await expect(espace.getByText(/Bons de bienvenue des inscrits ce mois : 1 \/ 20\./)).toBeVisible();
    await expect(espace.getByRole("listitem").filter({ hasText: "Inscription en boutique · 1 bon" })).toContainText("250 DA");
  });
  await espace.context().close();
});
