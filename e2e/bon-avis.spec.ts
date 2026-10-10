// US-32.5 : petit bon pour chaque avis. Programme « avis » réglé dans la base LOCALE seulement (en production : à créer
// par le propriétaire avec select prive.regler_bon_avis(<budget du mois>)), remis à 0 (arrêté) à la fin.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql } from "./outils/donnees";
import { avancerCommande, commanderArticle, connecterEspace, lireJetonRetrait, remettre } from "./outils/parcours";

test.afterAll(async () => {
  await sql("select prive.regler_bon_avis(0)");
  await fermerBase();
});

test("bon « avis » : mention sur la vitrine → retrait par QR code → avis 2 étoiles → « Votre bon de 150 DA est dans votre compte. » → Mes bons → panier", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const boutique = await creerBoutique({ nom: `Boutique Bon Avis ${Date.now().toString(36)}` });
  const article = await creerArticle(boutique.id, { prix: 2000, titre: "Robe bon avis" });
  const client = await creerCompte({ nom: "Lina Amrani" }); // numéro vérifié à la création
  const espace = await connecterEspace(browser, (await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" })).email);

  await test.step("récompense arrêtée : pas de mention sur la vitrine", async () => {
    await sql("select prive.regler_bon_avis(0)");
    await page.goto(`/b/${boutique.slug}`);
    await expect(page.getByRole("region", { name: "Avis clients" })).toBeVisible();
    await expect(page.getByText("Les clients reçoivent un petit bon pour chaque avis, quelle que soit leur note.")).toHaveCount(0);
  });

  await test.step("récompense active : mention (texte n° 11)", async () => {
    await sql("select prive.regler_bon_avis(10000000)");
    await page.goto(`/b/${boutique.slug}`);
    await expect(page.getByRole("region", { name: "Avis clients" })).toContainText("Les clients reçoivent un petit bon pour chaque avis, quelle que soit leur note.");
  });

  const suivi = await commanderArticle(page, article, { email: client.email });
  const id = suivi.split("/").pop()!;
  await test.step("la boutique remet la commande par QR code", async () => {
    await avancerCommande(espace, "a_confirmer", "Lina", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Lina", "Prête");
    await page.goto(suivi);
    await espace.goto(`/espace/retrait/${await lireJetonRetrait(page)}`);
    await remettre(espace, /^Commande n° \d+$/);
  });

  await test.step("avis 2 étoiles (la note ne compte pas) : merci + « Votre bon de 150 DA est dans votre compte. »", async () => {
    await page.goto(`/compte/commandes/${id}/avis`);
    await page.getByRole("radio", { name: "2 sur 5" }).click();
    await page.getByRole("button", { name: "Publier mon avis" }).click();
    const statut = page.getByRole("main").getByRole("status");
    await expect(statut).toContainText("Merci, votre avis est publié.");
    await expect(statut).toContainText(/Votre bon de 150\sDA est dans votre compte\./);
    const bons = await sql<{ montant: number; minimum_achat: number; statut: string }>(
      "select b.montant, b.minimum_achat, b.statut from bons b join prive.bons_avis t on t.bon_id = b.id join avis a on a.id = t.avis_id where a.commande_id = $1 and b.origine = 'avis'", [id]);
    expect(bons).toEqual([{ montant: 150, minimum_achat: 1500, statut: "disponible" }]);
  });

  await test.step("« Mes bons » : Bon Avis · 150 DA dès 1 500 DA d'achat", async () => {
    await page.goto("/compte");
    const bons = page.getByRole("region", { name: "Mes bons" });
    await expect(bons).toContainText("Bon Avis");
    await expect(bons).toContainText(/150\sDA dès 1\s500\sDA d’achat · jusqu’au \d{1,2}\/\d{1,2}/);
    // Phrase d'aide avec le montant réel du bon (demande de BOLOSS du 10/10), plus de « 300 DA » écrit en dur.
    await expect(bons).toContainText(/À utiliser au panier : 150\sDA de moins, payés par BleDeal à la boutique\./);
    await expect(bons).not.toContainText(/300\sDA/);
  });

  await test.step("panier de 2 000 DA : « Utiliser mon bon Avis (−150 DA) »", async () => {
    await page.goto(`/a/${article.id}`);
    await page.getByRole("button", { name: "Taille M" }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await expect(page.getByRole("checkbox", { name: /Utiliser mon bon Avis \(−150\sDA\)/ })).toBeVisible();
    await page.evaluate(() => localStorage.clear());
  });

  await test.step("vitrine en arabe : mention (texte n° 11)", async () => {
    await page.goto("/villes");
    await page.getByRole("form", { name: "Langue" }).getByRole("button").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.goto(`/b/${boutique.slug}`);
    await expect(page.getByText("الكليان ياخذو بون صغير على كل راي، مهما كانت النقطة.")).toBeVisible();
  });
  await espace.context().close();
});

test("/admin/bons : programme « avis » à budget mensuel, « reste … ce mois-ci » (bons du mois seulement)", async ({ browser }) => {
  await sql("select prive.regler_bon_avis(100000)");
  const client = await creerCompte({ nom: "Reste Mois" });
  // Un bon « avis » du mois dernier : compté dans le total, pas dans le reste du mois.
  await sql(`insert into bons (profil_id, montant, origine, programme_id, minimum_achat, statut, expire_le, cree_le)
    select $1, 150, 'avis', id, 1500, 'disponible', now() + interval '30 days', now() - interval '1 month' from programmes_bons where type = 'avis'`, [client.id]);
  const [{ reste }] = await sql<{ reste: number }>("select prive.budget_avis_restant(p) as reste from programmes_bons p where p.type = 'avis'");
  const admin = await connecterEspace(browser, (await creerCompte({ role: "admin", nom: "Hakim" })).email);
  await admin.goto("/admin/bons");
  const avis = admin.getByRole("list", { name: "Programmes" }).getByRole("listitem").filter({ hasText: /^Avis/ });
  await expect(avis).toContainText(new RegExp(`reste ${new Intl.NumberFormat("fr-FR").format(reste).replace(/\s/g, "\\s")}\\sDA ce mois-ci`));
  await admin.context().close();
});
