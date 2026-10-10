// US-32 : avis clients sur les boutiques. Commande retirée par QR code → « Donner mon avis » dans « Mes commandes »
// → filtre de contenu (numéro refusé) → avis publié → note affichée, plus de bouton. Toujours sur Supabase local.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql, unique } from "./outils/donnees";
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
  await test.step("vitrine : sous le seuil, « Pas encore assez d'avis », le commentaire s'affiche déjà", async () => {
    await page.goto(`/b/${boutique.slug}`);
    const avis = page.getByRole("region", { name: "Avis clients" });
    await expect(avis).toContainText("Pas encore assez d’avis");
    await expect(avis).toContainText("Amine B.");
    await expect(avis).toContainText("Très bon accueil, la robe est comme sur la photo.");
    await expect(avis.getByRole("img", { name: "4 étoiles sur 5" })).toBeVisible();
  });
  await espace.context().close();
});

/** Avis posé directement dans la base locale (commande récupérée par QR code), comme après le parcours ci-dessus. */
async function avisDirect(boutique: string, note: number, nom: string, criteres: string[], commentaire: string | null) {
  const client = await creerCompte({ nom });
  const texte = commentaire === null ? "null" : `'${commentaire.replace(/'/g, "''")}'`;
  // Déclencheurs de commande coupés le temps de poser l'état final (seul l'avis compte ici).
  await sql(`begin; set local session_replication_role = replica;
    with c as (insert into commandes (client_id, boutique_id, statut, client_nom, client_telephone, total, mode_remise, terminee_le)
      values ('${client.id}', '${boutique}', 'recuperee', '${nom.replace(/'/g, "''")}', '${client.telephone}', 3500, 'qr', now() - interval '1 day') returning id)
    insert into avis (commande_id, boutique_id, client_id, note, criteres, commentaire)
      select id, '${boutique}', '${client.id}', ${note}, '{${criteres.join(",")}}', ${texte} from c;
    commit;`);
}

test("avis affichés : vitrine (note à partir de 3 avis, critères), fiche, catalogue « Mieux notées », arabe", async ({ page }) => {
  test.setTimeout(120_000);
  const u = unique();
  const notee = await creerBoutique({ nom: `Boutique Nour ${u}` });
  const articleNote = await creerArticle(notee.id, { titre: `Abaya ${u} notée` });
  const sansAvis = await creerBoutique({ nom: `Kids Style ${u}` });
  await creerArticle(sansAvis.id, { titre: `Abaya ${u} récente` });
  await avisDirect(notee.id, 5, "Amine Benali", ["accueil"], "Très bon accueil.");
  await avisDirect(notee.id, 4, "Sara Kaci", ["accueil", "rapidite"], "Un peu d'attente au retrait.");
  await avisDirect(notee.id, 4, "Nadia Mansouri", [], null);
  const mois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Algiers" }).format(new Date(Date.now() - 24 * 3600 * 1000));

  await test.step("vitrine : « ★ 4,3 · 3 avis », critères les plus cités, derniers avis (prénom et initiale, mois)", async () => {
    await page.goto(`/b/${notee.slug}`);
    await expect(page.getByRole("link", { name: "★ 4,3 · 3 avis" })).toHaveAttribute("href", "#avis");
    const avis = page.getByRole("region", { name: "Avis clients" });
    await expect(avis).toContainText("Bon accueil · 2");
    await expect(avis).toContainText("Rapide · 1");
    await expect(avis).toContainText("Sara K.");
    await expect(avis).toContainText("Nadia M.");
    await expect(avis).toContainText(mois);
    await expect(avis).not.toContainText("Kaci");
    await expect(avis.getByRole("link", { name: "Voir tous les avis" })).toHaveCount(0);
  });

  await test.step("fiche article : « Boutique Nour · ★ 4,3 (3 avis) » vers les avis de la vitrine", async () => {
    await page.goto(`/a/${articleNote.id}`);
    await expect(page.getByRole("link", { name: `${notee.nom} · ★ 4,3 (3 avis)` })).toHaveAttribute("href", `/b/${notee.slug}#avis`);
  });

  await test.step("catalogue : « Mieux notées » met la boutique notée devant, la boutique sans avis à la fin", async () => {
    const titres = async () => page.getByRole("main").getByRole("heading", { level: 3 }).allInnerTexts();
    await page.goto(`/oran/catalogue?q=${u}`);
    expect(await titres()).toEqual([`Abaya ${u} récente`, `Abaya ${u} notée`]);
    await page.getByLabel("Trier").selectOption({ label: "Mieux notées" });
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await expect(page).toHaveURL(/tri=notes/);
    expect(await titres()).toEqual([`Abaya ${u} notée`, `Abaya ${u} récente`]);
    await expect(page.getByText("★ 4,3 · 3 avis")).toBeVisible();
  });

  await test.step("en arabe : « ★ 4,3 · 3 راي », « مازال ما كاينش بزاف تاع الآراء » sous le seuil", async () => {
    await page.goto("/villes");
    await page.getByRole("form", { name: "Langue" }).getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.goto(`/b/${notee.slug}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("region", { name: "آراء الكليان" })).toContainText("★ 4,3 · 3 راي");
    await page.goto(`/b/${sansAvis.slug}`);
    await expect(page.getByRole("region", { name: "آراء الكليان" })).toContainText("مازال ما كاينش بزاف تاع الآراء");
  });
});
