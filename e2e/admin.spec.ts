// Parcours admin (carte Trello, §1) : valider une boutique, traiter un signalement, ouvrir / fermer une ville.
// Le relevé des bons « Marquer comme payé » est dans parrainage.spec.ts (il a besoin d'un vrai bon utilisé).
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql, unique } from "./outils/donnees";
import { connecterClient, connecterEspace } from "./outils/parcours";

test.afterAll(fermerBase);

test("admin : valider une boutique en attente et y rattacher le commerçant", async ({ browser }) => {
  const boutique = await creerBoutique({ statut: "en_attente" });
  const futurCommercant = await creerCompte({ nom: "Yacine", prefixe: "commercant" });
  const admin = await creerCompte({ role: "admin", nom: "Hakim" });
  const page = await connecterEspace(browser, admin.email);

  // « Tous les statuts » : après validation, la boutique reste dans la liste (le filtre « En attente » la ferait sortir).
  await page.goto("/admin/boutiques?statut=tous");
  await expect(page.getByRole("heading", { name: "Les boutiques" })).toBeVisible();
  const fiche = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: boutique.nom }) });
  await expect(fiche).toContainText("En attente");
  await fiche.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(fiche).toContainText("Validée");

  await fiche.getByLabel(`E-mail du commerçant pour ${boutique.nom}`).fill(futurCommercant.email);
  await fiche.getByRole("button", { name: "Rattacher" }).click();
  await expect(fiche.getByRole("status")).toBeVisible();
  await page.context().close();

  // Le commerçant rattaché entre dans son espace et voit ses articles (vides).
  const espace = await connecterEspace(browser, futurCommercant.email);
  await espace.goto("/espace");
  await expect(espace.getByRole("heading", { name: "Mes articles" })).toBeVisible();
  // La boutique validée est publique.
  await espace.goto(`/b/${boutique.slug}`);
  await expect(espace.getByRole("heading", { name: boutique.nom })).toBeVisible();
  await espace.context().close();
});

test("admin : traiter un signalement (masquer l'article)", async ({ browser }) => {
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id, { titre: `Sac signalé ${unique()}` });
  // Le formulaire public de signalement demande Turnstile et le secret des visiteurs (absents des tests) :
  // le signalement est posé en base, comme s'il venait d'un visiteur.
  await sql("insert into signalements (article_id, motif, commentaire) values ($1, 'contrefacon', 'Copie d''une marque.')", [article.id]);
  const admin = await creerCompte({ role: "admin", nom: "Hakim" });
  const page = await connecterEspace(browser, admin.email);

  await page.goto("/admin/moderation");
  await expect(page.getByRole("heading", { name: "Modération" })).toBeVisible();
  const groupe = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: article.titre }) });
  await expect(groupe).toContainText("Contrefaçon : 1");
  await groupe.getByRole("button", { name: "Masquer l’article" }).click();
  await groupe.getByRole("button", { name: "Confirmer le masquage" }).click();
  await expect(groupe.getByRole("status")).toBeVisible();

  await page.context().close();
  // Un visiteur ne voit plus l'article (l'admin, lui, peut encore l'ouvrir).
  const visiteur = await browser.newPage();
  await visiteur.goto(`/a/${article.id}`);
  await expect(visiteur.getByRole("heading", { level: 1, name: article.titre })).toHaveCount(0);
  await visiteur.close();
});

test("admin : ouvrir puis refermer une ville", async ({ browser }) => {
  // Mostaganem est fermée au départ (migrations) ; une boutique validée y est posée pour qu'elle ait quelque chose à montrer.
  await sql("update villes set ouverte = false where code = 'mostaganem'");
  await creerBoutique({ ville: "mostaganem", latitude: 35.93, longitude: 0.09 });
  const admin = await creerCompte({ role: "admin", nom: "Hakim" });
  const page = await connecterEspace(browser, admin.email);
  try {
    await page.goto("/admin/villes");
    await page.getByRole("button", { name: "Mostaganem : fermée, ouvrir" }).click();
    await expect(page.getByRole("group", { name: "Confirmation" })).toContainText("Ouvrir Mostaganem ?");
    await page.getByRole("group", { name: "Confirmation" }).getByRole("button", { name: "Ouvrir" }).click();
    await expect(page.getByRole("button", { name: "Mostaganem : ouverte, fermer" })).toBeVisible();

    const visiteur = await browser.newPage();
    await visiteur.goto("/villes");
    await expect(visiteur.getByRole("list", { name: "Villes" }).getByRole("button", { name: /^Mostaganem/ })).toBeVisible();

    await page.getByRole("button", { name: "Mostaganem : ouverte, fermer" }).click();
    await page.getByRole("group", { name: "Confirmation" }).getByRole("button", { name: "Fermer" }).click();
    await expect(page.getByRole("button", { name: "Mostaganem : fermée, ouvrir" })).toBeVisible();
    await visiteur.reload();
    await expect(visiteur.getByRole("list", { name: "Villes" }).getByRole("button", { name: /^Mostaganem/ })).toHaveCount(0);
    await visiteur.close();
  } finally {
    await sql("update villes set ouverte = false where code = 'mostaganem'");
    await page.context().close();
  }
});

test("US-33.5 admin : créer une campagne, le client ajoute le code, arrêter la campagne", async ({ browser, page }) => {
  test.setTimeout(90_000);
  const code = `ADM${unique().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}`;
  const jour = (decalage: number) => new Date(Date.now() + 3_600_000 + decalage * 86_400_000).toISOString().slice(0, 10); // Algérie : UTC+1
  const admin = await creerCompte({ role: "admin", nom: "Hakim" });
  const client = await creerCompte({ nom: "Yasmine" });
  const espace = await connecterEspace(browser, admin.email);
  try {
    await espace.goto("/admin/bons");
    await expect(espace.getByRole("heading", { name: "Bons", exact: true })).toBeVisible();
    await expect(espace.getByLabel("Montant (DA)")).toHaveValue("500");
    await expect(espace.getByLabel("Plafond par boutique (bons)")).toHaveValue("30");
    await espace.getByLabel("Nom (français)").fill("Campagne admin");
    await espace.getByLabel("Nom (arabe)").fill("حملة");
    await espace.getByLabel("Code").fill(code.toLowerCase());
    await espace.getByRole("checkbox", { name: "Oran" }).check();
    await espace.getByLabel("Début").fill(jour(0));
    await espace.getByLabel("Fin (incluse)").fill(jour(5));
    await espace.getByLabel("Budget (DA)").fill("100000");
    await espace.getByRole("button", { name: "Créer la campagne" }).click();
    await expect(espace.getByRole("status").filter({ hasText: "créée" })).toHaveText(`Campagne Campagne admin créée (code ${code}).`);
    const fiche = espace.getByRole("list", { name: "Programmes" }).getByRole("listitem").filter({ hasText: code });
    await expect(fiche).toContainText("Active");
    await expect(fiche).toContainText("0 émis");

    await connecterClient(page, client.email);
    await page.goto("/compte");
    await page.getByRole("button", { name: "J’ai un code" }).click();
    await page.getByRole("textbox", { name: "J’ai un code" }).fill(code);
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("status").filter({ hasText: "ajouté" })).toHaveText(/^Bon Campagne admin ajouté : 500\sDA dès 4\s000\sDA d’achat\.$/);

    await espace.reload();
    await expect(fiche).toContainText("1 émis");
    await fiche.getByRole("button", { name: "Arrêter" }).click();
    await expect(fiche).toContainText("Plus aucun nouveau bon");
    await fiche.getByRole("button", { name: "Arrêter" }).first().click();
    await expect(fiche.getByRole("status")).toHaveText("Arrêté : plus aucun nouveau bon. Les bons déjà donnés restent valables jusqu’à leur échéance.");
    await expect(fiche).toContainText("Arrêtée");
    const etat = await sql<{ actif: boolean }>("select actif from programmes_bons where code = $1", [code]);
    expect(etat).toEqual([{ actif: false }]);
  } finally {
    await sql("update programmes_bons set actif = false where code = $1", [code]);
    await espace.context().close();
  }
});
