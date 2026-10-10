// Parcours boutique (carte Trello, §1) : commande reçue → confirmer → prête → code à 6 chiffres ou QR code → remise.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase } from "./outils/donnees";
import { avancerCommande, commanderArticle, connecterEspace, lireCodeRetrait, lireJetonRetrait, remettre } from "./outils/parcours";

test.afterAll(fermerBase);

async function preparer(nomClient: string) {
  const boutique = await creerBoutique();
  const article = await creerArticle(boutique.id);
  const client = await creerCompte({ nom: nomClient });
  const marchand = await creerCompte({ role: "commercant", boutique: boutique.id, nom: "Karim" });
  return { boutique, article, client, marchand };
}

test("boutique : confirmer, prête, code à 6 chiffres, remis au client", async ({ page, browser }) => {
  const { article, client, marchand } = await preparer("Amine");
  const suivi = await commanderArticle(page, article, { email: client.email });

  const espace = await connecterEspace(browser, marchand.email);
  await test.step("commande reçue, confirmer puis prête", async () => {
    await espace.goto("/espace/commandes");
    await expect(espace.getByRole("heading", { name: "Commandes reçues" })).toBeVisible();
    await expect(espace.getByRole("link", { name: "À confirmer 1" })).toBeVisible();
    await avancerCommande(espace, "a_confirmer", "Amine", "Confirmer");
    await avancerCommande(espace, "a_preparer", "Amine", "Prête");
    await expect(espace.getByRole("link", { name: "Prêtes 1" })).toBeVisible();
  });

  let code = "";
  await test.step("le client voit son QR code et son code", async () => {
    await page.goto(suivi);
    await expect(page.getByRole("heading", { name: "Prête à récupérer" })).toBeVisible();
    await expect(page.getByRole("img", { name: /QR code de retrait/ })).toBeVisible();
    code = await lireCodeRetrait(page);
  });

  await test.step("la boutique tape le code et remet la commande", async () => {
    await espace.goto("/espace/scanner");
    await espace.getByLabel("La caméra ne marche pas ? Tapez le code à 6 chiffres").fill(code);
    await espace.getByRole("button", { name: "Voir la commande" }).click();
    await remettre(espace, /^Commande n° \d+$/);
  });

  await test.step("le client voit « Récupérée »", async () => {
    await page.reload();
    await expect(page.getByRole("list", { name: "Suivi de la commande" })).not.toContainText("Récupérée (à venir)");
    await expect(page.getByRole("list", { name: "Suivi de la commande" })).toContainText("Récupérée");
  });
  await espace.context().close();
});

test("boutique : QR code du client (lien du scanner), remis au client", async ({ page, browser }) => {
  const { article, client, marchand } = await preparer("Nadia");
  const suivi = await commanderArticle(page, article, { email: client.email });
  const espace = await connecterEspace(browser, marchand.email);
  await avancerCommande(espace, "a_confirmer", "Nadia", "Confirmer");
  await avancerCommande(espace, "a_preparer", "Nadia", "Prête");

  await page.goto(suivi);
  const jeton = await lireJetonRetrait(page);
  await espace.goto(`/espace/retrait/${jeton}`);
  await remettre(espace, /^Commande n° \d+$/);
  await espace.goto("/espace/commandes?etape=terminees");
  await expect(espace.getByRole("button", { name: /^N° \d+ · Nadia\b/ })).toBeVisible();
  await espace.context().close();
});
