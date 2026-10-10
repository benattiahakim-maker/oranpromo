// US-32 : avis clients sur les boutiques. Commande retirée par QR code → « Donner mon avis » dans « Mes commandes »
// → filtre de contenu (numéro refusé) → avis publié → note affichée, plus de bouton. Toujours sur Supabase local.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql } from "./outils/donnees";
import { avancerCommande, commanderArticle, connecterEspace, lireJetonRetrait, remettre } from "./outils/parcours";

test.afterAll(fermerBase);

test("avis : retrait par QR code → « Donner mon avis » → filtre → avis publié (prénom et initiale)", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const boutique = await creerBoutique({ nom: `Boutique Nour ${Date.now().toString(36)}` });
  const article = await creerArticle(boutique.id);
  const client = await creerCompte({ nom: "Amine Benali" });

  const suivi = await commanderArticle(page, article, { email: client.email });
  const id = suivi.split("/").pop()!;
  const espace = await connecterEspace(browser, (await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" })).email);

  await test.step("pas de bouton tant que la commande n'est pas retirée", async () => {
    await page.goto("/compte/commandes");
    await expect(page.getByRole("link", { name: "Donner mon avis" })).toHaveCount(0);
  });

  await test.step("la boutique confirme, prépare, puis remet la commande par QR code", async () => {
    await avancerCommande(espace, "a_confirmer", "Amine", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Amine", "Prête");
    await page.goto(suivi);
    const jeton = await lireJetonRetrait(page);
    await espace.goto(`/espace/retrait/${jeton}`);
    await remettre(espace, /^Commande n° \d+$/);
  });

  await test.step("« Mes commandes » : « Donner mon avis » sur la commande retirée", async () => {
    await page.goto("/compte/commandes");
    await page.getByRole("link", { name: "Donner mon avis" }).click();
    await expect(page).toHaveURL(new RegExp(`/compte/commandes/${id}/avis$`));
    await expect(page.getByRole("heading", { name: `Votre avis sur ${boutique.nom}` })).toBeVisible();
    await expect(page.getByText("Votre avis est public avec votre prénom et l’initiale de votre nom.")).toBeVisible();
  });

  await test.step("note obligatoire, puis numéro de téléphone refusé par le filtre", async () => {
    await page.getByRole("button", { name: "Publier mon avis" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Choisissez une note de 1 à 5 étoiles.");
    await page.getByRole("radio", { name: "4 sur 5" }).click();
    await page.getByRole("button", { name: "Bon accueil" }).click();
    await page.getByRole("button", { name: "Article conforme" }).click();
    await page.getByLabel("Commentaire (facultatif)").fill("Appelez-moi au 0555 12 34 56");
    await page.getByRole("button", { name: "Publier mon avis" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Votre commentaire ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier.");
    expect(await sql("select 1 from avis where commande_id = $1", [id])).toHaveLength(0);
  });

  await test.step("commentaire corrigé : « Merci, votre avis est publié. »", async () => {
    await page.getByLabel("Commentaire (facultatif)").fill("Très bon accueil, la robe est comme sur la photo.");
    await expect(page.getByText("49/300")).toBeVisible();
    await page.getByRole("button", { name: "Publier mon avis" }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Merci, votre avis est publié.");
    const [a] = await sql<{ note: number; criteres: string[]; commentaire: string; statut: string; boutique_id: string }>(
      "select note, criteres, commentaire, statut, boutique_id from avis where commande_id = $1", [id]);
    expect(a).toEqual({ note: 4, criteres: ["accueil", "article_conforme"], commentaire: "Très bon accueil, la robe est comme sur la photo.", statut: "publie", boutique_id: boutique.id });
    const [lu] = await sql<{ auteur: string }>("select auteur from avis_boutique($1)", [boutique.id]);
    expect(lu.auteur).toBe("Amine B.");
  });

  await test.step("plus de bouton : la note donnée s'affiche ; un second avis est impossible", async () => {
    await page.getByRole("link", { name: "Retour à la commande" }).click();
    await expect(page.getByText("Avis donné · ★ 4")).toBeVisible();
    await page.goto("/compte/commandes");
    await expect(page.getByRole("link", { name: "Donner mon avis" })).toHaveCount(0);
    await expect(page.getByText("Avis donné · ★ 4")).toBeVisible();
    await page.goto(`/compte/commandes/${id}/avis`);
    await expect(page.getByRole("button", { name: "Publier mon avis" })).toHaveCount(0);
  });
  await espace.context().close();
});
