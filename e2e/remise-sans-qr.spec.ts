// « Remis sans QR code » (US-26.3, décision 2) : la boutique remet une commande prête sans QR code ni code, derrière une
// confirmation. Ni bon ni parrainage ne s'appliquent alors (US-27, relecture n°6 : QR code seulement). Les règles ne
// sont pas réécrites ici : le test passe par les écrans, puis lit la base LOCALE pour vérifier ce qu'elle a décidé.
import { expect, test, type Page } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, ouvrirParrainage, sql } from "./outils/donnees";
import { avancerCommande, commanderArticle, commanderOuAccepter, connecterClient, connecterEspace } from "./outils/parcours";

test.afterAll(fermerBase);

const CONFIRMATION = "Le client n’a ni QR code ni code ? Remettez la commande seulement si vous le reconnaissez.";

/** Boutique, étape « Prêtes » : déplie la commande du client, « Remis sans QR code », lit la confirmation, confirme. */
async function remettreSansQr(espace: Page, client: string, avertissementBon?: string) {
  await espace.goto("/espace/commandes?etape=pretes");
  const ligne = espace.getByRole("button", { name: new RegExp(`^N° \\d+ · ${client}\\b`) });
  await ligne.click();
  await espace.getByRole("button", { name: "Remis sans QR code" }).click();
  // Confirmation obligatoire : rien n'est remis avant « Confirmer la remise » ; « Retour » existe.
  await expect(espace.getByText(CONFIRMATION)).toBeVisible();
  await expect(espace.getByRole("button", { name: "Retour", exact: true })).toBeVisible();
  if (avertissementBon) await expect(espace.getByText(avertissementBon)).toBeVisible();
  else await expect(espace.getByText(/le bon ne s’applique pas/)).toHaveCount(0);
  await espace.getByRole("button", { name: "Confirmer la remise" }).click();
  await expect(espace.getByRole("status").filter({ hasText: "Commande mise à jour." })).toBeVisible();
  await espace.goto("/espace/commandes?etape=pretes");
  await expect(ligne).toHaveCount(0);
  await espace.goto("/espace/commandes?etape=terminees");
  await expect(ligne).toBeVisible();
}

async function commande(suivi: string) {
  const id = suivi.split("/").pop();
  const [c] = await sql<{ statut: string; mode_remise: string | null; bon_id: string | null; remise_bon: number | null }>(
    "select statut, mode_remise, bon_id, remise_bon from commandes where id = $1", [id]);
  return { id: id!, ...c };
}

test("remis sans QR code : confirmation, première commande d'un filleul → parrainage non validé, aucun bon", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await ouvrirParrainage();
  await sql("insert into prive.reglages (cle, valeur) values ('parrainage_budget_mois', '10000000') on conflict (cle) do update set valeur = excluded.valeur");
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id, { prix: 2500 });
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  const parrain = await creerCompte({ nom: "Samir" });
  const filleul = await creerCompte({ nom: "Yasmine" });

  const contexteParrain = await browser.newContext();
  const pageParrain = await contexteParrain.newPage();
  let code = "";
  await test.step("le filleul enregistre le code de son parrain", async () => {
    await connecterClient(pageParrain, parrain.email);
    await pageParrain.goto("/parrainage");
    code = (await pageParrain.getByText("Ton code").locator("xpath=..").locator("strong").innerText()).trim();
    await connecterClient(page, filleul.email);
    await page.goto("/compte");
    await page.getByLabel("Ton parrain (facultatif) : son numéro WhatsApp ou son code").fill(code);
    await page.getByRole("button", { name: "Valider", exact: true }).click();
    await expect(page.getByText("Parrain enregistré")).toBeVisible();
  });

  const espace = await connecterEspace(browser, marchand.email);
  let suivi = "";
  await test.step("première commande de 2 500 DA (assez pour un parrainage), confirmée puis prête", async () => {
    suivi = await commanderArticle(page, article);
    await avancerCommande(espace, "a_confirmer", "Yasmine", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Yasmine", "Prête");
  });

  await test.step("la boutique remet sans QR code, après confirmation", async () => {
    await remettreSansQr(espace, "Yasmine");
  });

  await test.step("le client voit « Récupérée »", async () => {
    await page.goto(suivi);
    const frise = page.getByRole("list", { name: "Suivi de la commande" });
    await expect(frise).toContainText("Récupérée");
    await expect(frise).not.toContainText("Récupérée (à venir)");
  });

  await test.step("ni parrainage validé ni bon : rien chez le filleul ni chez le parrain", async () => {
    const c = await commande(suivi);
    expect(c).toMatchObject({ statut: "recuperee", mode_remise: "manuel", bon_id: null });
    const [p] = await sql<{ statut: string; motif: string | null }>("select statut, motif from parrainages where filleul_id = $1", [filleul.id]);
    expect(p).toEqual({ statut: "non_valide", motif: "remise_sans_qr_code" });
    const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from bons where profil_id in ($1, $2)", [filleul.id, parrain.id]);
    expect(n).toBe(0);
    for (const p of [page, pageParrain]) {
      await p.goto("/compte");
      await expect(p.getByRole("region", { name: "Mes bons" })).toHaveCount(0);
    }
  });
  await espace.context().close();
  await contexteParrain.close();
});

test("remis sans QR code : le bon réservé ne s'applique pas, il revient au client, rien à rembourser", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await ouvrirParrainage();
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id, { prix: 2500 });
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  const client = await creerCompte({ nom: "Ilyes" });
  // Bon de 300 DA déjà reçu par le client (posé dans la base LOCALE, comme après un parrainage validé).
  const [bon] = await sql<{ id: string }>(`insert into bons (profil_id, origine, statut, expire_le)
    values ($1, 'parrainage_filleul', 'disponible', now() + interval '60 days') returning id`, [client.id]);

  let suivi = "";
  await test.step("commande avec le bon : 2 200 DA à payer, bon réservé", async () => {
    await connecterClient(page, client.email);
    await page.goto(`/a/${article.id}`);
    await page.getByRole("button", { name: "Taille M" }).click();
    await page.getByRole("button", { name: "Ajouter au panier" }).click();
    await page.goto("/panier");
    await expect(page.getByRole("checkbox", { name: /Utiliser mon bon parrainage/ })).toBeChecked();
    await expect(page.getByText("2 200 DA").first()).toBeVisible();
    await commanderOuAccepter(page);
    await expect(page).toHaveURL(/\/compte\/commandes\/[0-9a-f-]{36}/);
    suivi = new URL(page.url()).pathname;
    expect(await commande(suivi)).toMatchObject({ bon_id: bon.id, remise_bon: 300 });
  });

  const espace = await connecterEspace(browser, marchand.email);
  await test.step("confirmée, prête, puis remise sans QR code : la boutique est prévenue d'encaisser le total", async () => {
    await avancerCommande(espace, "a_confirmer", "Ilyes", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Ilyes", "Prête");
    await remettreSansQr(espace, "Ilyes", "Sans QR code, le bon ne s’applique pas : encaissez 2 500 DA. Le bon reste au client.");
  });

  await test.step("le bon n'est pas utilisé : il revient au client, aucune ligne de relevé pour la boutique", async () => {
    const c = await commande(suivi);
    expect(c).toMatchObject({ statut: "recuperee", mode_remise: "manuel" });
    const [b] = await sql<{ statut: string; commande_id: string | null; releve_id: string | null }>(
      "select statut, commande_id, releve_id from bons where id = $1", [bon.id]);
    expect(b).toEqual({ statut: "disponible", commande_id: null, releve_id: null });
    const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from lignes_releve where commande_id = $1", [c.id]);
    expect(n).toBe(0);
    await page.goto("/compte");
    const bons = page.getByRole("region", { name: "Mes bons" });
    await expect(bons).toContainText("Bon parrainage");
    await expect(bons).toContainText("Disponible");
  });
  await espace.context().close();
});
