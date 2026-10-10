// US-31.5 : alerte WhatsApp « nouvelles promos ». Éteinte par défaut : le test l'allume sur la base LOCALE seulement
// (réglages 'alertes_whatsapp' et 'alertes_plafond_mois'), puis l'éteint. Aucun message n'est envoyé (pas de fournisseur
// WhatsApp en local) : on vérifie la ligne écrite dans la file. Voir docs/environnements.md.
import { expect, test } from "@playwright/test";
import { creerArticle, creerBoutique, creerCompte, fermerBase, sql } from "./outils/donnees";
import { seConnecterParEmail } from "./outils/connexion";

const eteindre = () => sql(`delete from prive.reglages where cle in ('alertes_whatsapp', 'alertes_plafond_mois')`);
test.afterAll(async () => { await eteindre(); await fermerBase(); });

test("éteintes par défaut : pas de case après « Suivre », pas de bloc dans « Mes boutiques »", async ({ page }) => {
  await eteindre();
  const boutique = await creerBoutique();
  const client = await creerCompte({ nom: "Amine" });
  await page.goto(`/b/${boutique.slug}`);
  await page.getByRole("button", { name: "Suivre", exact: true }).click();
  await seConnecterParEmail(page, client.email);
  await expect(page.getByRole("button", { name: "✓ Suivie" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.goto("/compte/boutiques");
  await expect(page.getByRole("heading", { name: "Mes boutiques (1)" })).toBeVisible();
  await expect(page.getByText("Alertes WhatsApp")).toHaveCount(0);
});

test("allumées : case à part après « Suivre » → accord → nouvelle promo → un message → « Ne plus recevoir » → réactiver", async ({ page, browser }) => {
  await sql(`insert into prive.reglages (cle, valeur) values ('alertes_whatsapp', 'on'), ('alertes_plafond_mois', '100')
             on conflict (cle) do update set valeur = excluded.valeur`);
  const boutique = await creerBoutique({ nom: `Boutique Nour ${Date.now().toString(36)}` });
  const article = await creerArticle(boutique.id);
  const client = await creerCompte({ nom: "Amine Benali" });

  await test.step("vitrine : « Suivre » puis la case, non cochée, à part", async () => {
    await page.goto(`/b/${boutique.slug}`);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await page.getByRole("button", { name: "Suivre", exact: true }).click();
    await seConnecterParEmail(page, client.email);
    await expect(page.getByRole("button", { name: "✓ Suivie" })).toBeVisible();
    const caseAccord = page.getByRole("checkbox", { name: /Recevoir sur WhatsApp les nouvelles promos des boutiques que je suis/ });
    await expect(caseAccord).not.toBeChecked();
    expect(await sql(`select 1 from prive.alertes_whatsapp where profil_id = $1`, [client.id])).toEqual([]);
    await caseAccord.check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alertes WhatsApp activées" })).toBeVisible();
    const journal = await sql<{ action: string; source: string; numero: string }>(`select action, source, numero from prive.journal_alertes_whatsapp where profil_id = $1`, [client.id]);
    expect(journal).toEqual([{ action: "accord", source: "vitrine", numero: client.telephone }]);
  });

  await test.step("nouvelle promo → préparation du matin → un message dans la file, sans le jeton", async () => {
    await sql(`insert into promos (article_id, prix_promo, date_fin) values ($1, 2500, now() + interval '3 days')`, [article.id]);
    const [{ n }] = await sql<{ n: number }>(`select prive.preparer_alertes_whatsapp() as n`);
    expect(n).toBeGreaterThanOrEqual(1);
    const messages = await sql<{ modele: string; parametres: string[]; texte: string }>(
      `select modele, parametres, texte from messages_whatsapp where destinataire = $1 and modele like 'bledeal%'`, [client.telephone]);
    expect(messages).toEqual([{ modele: "bledeal_nouvelles_promos", parametres: ["Amine", boutique.nom, client.id],
      texte: `Bonjour Amine, de nouvelles promos sur BleDeal dans les boutiques que vous suivez : ${boutique.nom}.` }]);
    const [{ n: deuxieme }] = await sql<{ n: number }>(`select prive.preparer_alertes_whatsapp() as n`);
    expect(deuxieme).toBe(0);
  });

  await test.step("lien « Ne plus recevoir » sans connexion : l'ouverture ne change rien, le bouton arrête", async () => {
    const [{ jeton }] = await sql<{ jeton: string }>(`select jeton from prive.alertes_whatsapp where profil_id = $1`, [client.id]);
    // Autre navigateur, sans session : comme le bouton du message WhatsApp ouvert sur un téléphone non connecté.
    const contexte = await browser.newContext();
    const lien = await contexte.newPage();
    await lien.goto(`/alertes/${jeton}`);
    await expect(lien.getByText("Ne plus recevoir sur WhatsApp les nouvelles promos des boutiques que vous suivez ?")).toBeVisible();
    expect(await sql(`select actif from prive.alertes_whatsapp where profil_id = $1`, [client.id])).toEqual([{ actif: true }]);
    await lien.getByRole("button", { name: "Ne plus recevoir" }).click();
    await expect(lien.getByRole("status")).toContainText("Vous ne recevrez plus d’alertes.");
    await expect(lien.getByRole("status")).toContainText("Vous suivez toujours vos boutiques.");
    expect(await sql(`select actif from prive.alertes_whatsapp where profil_id = $1`, [client.id])).toEqual([{ actif: false }]);
    expect(await sql(`select 1 from abonnements_boutique where profil_id = $1`, [client.id])).toHaveLength(1);
    await lien.goto(`/alertes/${"0".repeat(48)}`);
    await expect(lien.getByText("Ce lien n’est pas valide.")).toBeVisible();
    await contexte.close();
  });

  await test.step("« Mes boutiques » : Désactivées → Activer → Désactiver", async () => {
    await page.goto("/compte/boutiques");
    const bloc = page.getByRole("region", { name: "Alertes WhatsApp" });
    await expect(bloc.getByRole("status")).toHaveText("Désactivées.");
    await bloc.getByRole("button", { name: "Activer" }).click();
    await expect(bloc.getByRole("status")).toHaveText("Activées : un message par jour au plus.");
    await bloc.getByRole("button", { name: "Désactiver" }).click();
    await expect(bloc.getByRole("status")).toHaveText("Désactivées.");
    const journal = await sql<{ action: string; source: string }>(`select action, source from prive.journal_alertes_whatsapp where profil_id = $1 order by id`, [client.id]);
    expect(journal).toEqual([{ action: "accord", source: "vitrine" }, { action: "retrait", source: "lien" }, { action: "accord", source: "compte" }, { action: "retrait", source: "compte" }]);
  });
});
