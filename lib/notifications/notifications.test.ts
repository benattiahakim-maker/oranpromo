import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { DUREE_ENVOI_MAX_MS, envoyerMessages, envoyerMessagesCommande, envoyerMessagesEnAttente, fournisseurWhatsApp, jetonNotifications, lireMessages, type FournisseurWhatsApp, type MessageWhatsApp } from ".";

const JETON = "jeton-serveur-0123456789";
import { corpsMessageMeta, creerFournisseurMeta, langueModeleMeta } from "./meta";

const message: MessageWhatsApp = { id: "m1", reservation: "r1", destinataire: "+213555111222", modele: "oranpromo_commande_prete", parametres: ["Samia", "12", "Boutique Un", "10/10 à 12h00"], texte: "Bonjour Samia…" };
const base = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient<Database>;

describe("choix du fournisseur WhatsApp (US-20.5)", () => {
  it("aucun envoi sans jeton ou sans numéro", () => {
    expect(fournisseurWhatsApp({})).toBeNull();
    expect(fournisseurWhatsApp({ WHATSAPP_TOKEN: "t" })).toBeNull();
    expect(fournisseurWhatsApp({ WHATSAPP_PHONE_NUMBER_ID: "1" })).toBeNull();
  });
  it("Meta par défaut quand tout est configuré ; fournisseur inconnu = aucun envoi", () => {
    expect(fournisseurWhatsApp({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" })?.nom).toBe("meta");
    expect(fournisseurWhatsApp({ WHATSAPP_FOURNISSEUR: "twilio", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" })).toBeNull();
  });
});

describe("jeton serveur (relecture point 5)", () => {
  it("CRON_SECRET d’au moins 16 caractères, sinon aucun", () => {
    expect(jetonNotifications({ CRON_SECRET: " jeton-serveur-0123456789 " })).toBe(JETON);
    expect(jetonNotifications({ CRON_SECRET: "court" })).toBeNull();
    expect(jetonNotifications({})).toBeNull();
  });
});

describe("WhatsApp Cloud API (Meta)", () => {
  it("construit un message modèle en français avec les paramètres", () => {
    expect(corpsMessageMeta(message, "fr")).toEqual({
      messaging_product: "whatsapp", to: "213555111222", type: "template",
      template: { name: "oranpromo_commande_prete", language: { code: "fr" }, components: [{ type: "body", parameters: message.parametres.map(text => ({ type: "text", text })) }] },
    });
    expect(corpsMessageMeta({ ...message, parametres: [] }, "fr").template.components).toEqual([]);
  });
  it("appelle l'API Graph avec le jeton et lit l'identifiant", async () => {
    const requete = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }));
    const fournisseur = creerFournisseurMeta({ token: "jeton", phoneNumberId: "123", langue: "fr", version: "v23.0", fetch: requete });
    expect(await fournisseur.envoyer(message)).toEqual({ succes: true, identifiant: "wamid.1" });
    const [url, options] = requete.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/123/messages");
    expect(options.headers.Authorization).toBe("Bearer jeton");
  });
  it("400 = échec définitif, 500 et réseau = on réessaie", async () => {
    const reponse400 = new Response(JSON.stringify({ error: { code: 132001, message: "Template name does not exist" } }), { status: 400 });
    let fournisseur = creerFournisseurMeta({ token: "t", phoneNumberId: "1", langue: "fr", version: "v23.0", fetch: vi.fn().mockResolvedValue(reponse400) });
    expect(await fournisseur.envoyer(message)).toEqual({ succes: false, erreur: "Meta 400 : 132001 Template name does not exist", definitif: true });
    fournisseur = creerFournisseurMeta({ token: "t", phoneNumberId: "1", langue: "fr", version: "v23.0", fetch: vi.fn().mockResolvedValue(new Response("oups", { status: 503 })) });
    expect(await fournisseur.envoyer(message)).toEqual({ succes: false, erreur: "Meta 503", definitif: false });
    fournisseur = creerFournisseurMeta({ token: "t", phoneNumberId: "1", langue: "fr", version: "v23.0", fetch: vi.fn().mockRejectedValue(new Error("réseau")) });
    expect(await fournisseur.envoyer(message)).toEqual({ succes: false, erreur: "WhatsApp injoignable.", definitif: false });
  });
});

describe("file d'attente", () => {
  it("lit les lignes réservées et convertit les paramètres", () => {
    expect(lireMessages([{ id: "a", reservation: null, destinataire: "+213555111222", modele: "m", parametres: [], texte: "" }, { id: "b", reservation: "r", destinataire: "+213555111222", modele: "m", parametres: ["x", 2], texte: "t" }]))
      .toEqual([{ id: "b", reservation: "r", destinataire: "+213555111222", modele: "m", parametres: ["x", "2"], texte: "t" }]);
  });
  it("enregistre chaque résultat avec la réservation", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const envoyer = vi.fn().mockResolvedValueOnce({ succes: true, identifiant: "wamid.1" }).mockResolvedValueOnce({ succes: false, erreur: "Meta 400", definitif: true }).mockRejectedValueOnce(new Error("bug"));
    const resultat = await envoyerMessages(base(rpc), [message, { ...message, id: "m2", reservation: "r2" }, { ...message, id: "m3", reservation: "r3" }], { nom: "test", envoyer }, JETON);
    expect(resultat).toEqual({ envoyes: 1, echecs: 2, reportes: 0 });
    // Relecture point 5 : le résultat part avec le jeton du serveur.
    expect(rpc).toHaveBeenNthCalledWith(1, "resultat_message_whatsapp", { jeton: JETON, message: "m1", reservation: "r1", succes: true, identifiant: "wamid.1" });
    expect(rpc).toHaveBeenNthCalledWith(2, "resultat_message_whatsapp", { jeton: JETON, message: "m2", reservation: "r2", succes: false, erreur: "Meta 400", definitif: true });
    expect(rpc).toHaveBeenNthCalledWith(3, "resultat_message_whatsapp", { jeton: JETON, message: "m3", reservation: "r3", succes: false, erreur: "Erreur d’envoi.", definitif: false });
  });
  it("relecture point 6 : aucun envoi ne commence s’il risque de dépasser l’heure limite", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    let horloge = 0;
    const envoyer = vi.fn().mockImplementation(async () => { horloge += 10_000; return { succes: true, identifiant: null }; });
    const messages = [1, 2, 3, 4, 5].map(i => ({ ...message, id: `m${i}`, reservation: `r${i}` }));
    const resultat = await envoyerMessages(base(rpc), messages, { nom: "test", envoyer }, JETON, { finAvant: 20_000 + DUREE_ENVOI_MAX_MS, maintenant: () => horloge });
    expect(resultat).toEqual({ envoyes: 3, echecs: 0, reportes: 2 });
    expect(envoyer).toHaveBeenCalledTimes(3);
  });
  it("après une action : rien sans fournisseur, sinon les messages de la commande ; jamais d'erreur", async () => {
    const rpc = vi.fn();
    expect(await envoyerMessagesCommande(base(rpc), "c1", null, JETON)).toEqual({ envoyes: 0, echecs: 0, reportes: 0 });
    const fournisseur: FournisseurWhatsApp = { nom: "test", envoyer: vi.fn().mockResolvedValue({ succes: true, identifiant: null }) };
    // Sans jeton serveur (CRON_SECRET), rien ne part : le résultat ne pourrait pas être enregistré.
    expect(await envoyerMessagesCommande(base(rpc), "c1", fournisseur, null)).toEqual({ envoyes: 0, echecs: 0, reportes: 0 });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: [{ ...message, parametres: message.parametres }], error: null }).mockResolvedValue({ error: null });
    expect(await envoyerMessagesCommande(base(rpc), "c1", fournisseur, JETON)).toEqual({ envoyes: 1, echecs: 0, reportes: 0 });
    expect(rpc).toHaveBeenCalledWith("resultat_message_whatsapp", expect.objectContaining({ jeton: JETON }));
    expect(rpc).toHaveBeenCalledWith("messages_whatsapp_commande", { commande: "c1" });
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await envoyerMessagesCommande(base(vi.fn().mockResolvedValue({ data: null, error: { message: "Commande introuvable." } })), "c1", fournisseur, JETON)).toEqual({ envoyes: 0, echecs: 0, reportes: 0 });
    erreur.mockRestore();
  });
  it("tâche planifiée : transmet le jeton et signale un refus", async () => {
    const fournisseur: FournisseurWhatsApp = { nom: "test", envoyer: vi.fn().mockResolvedValue({ succes: true, identifiant: null }) };
    const rpc = vi.fn().mockResolvedValueOnce({ data: [message], error: null }).mockResolvedValue({ error: null });
    expect(await envoyerMessagesEnAttente(base(rpc), "secret", fournisseur)).toEqual({ envoyes: 1, echecs: 0, reportes: 0, traites: 1 });
    // Relecture point 6 : 5 messages par appel par défaut.
    expect(rpc).toHaveBeenCalledWith("messages_whatsapp_en_attente", { jeton: "secret", limite: 5 });
    await expect(envoyerMessagesEnAttente(base(vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } })), "x", fournisseur)).rejects.toThrow("Accès refusé.");
  });
});

describe("US-20.6 : bouton « Confirmer » (lien signé)", () => {
  const ID = "0b9f2c1e-5a4d-4c3b-9e8f-112233445566";
  const ligne = { id: "m2", reservation: "r2", destinataire: "+213555111222", modele: "oranpromo_nouvelle_commande_confirmer", parametres: ["15", "Samia", "2", "8 700 DA", ID], texte: "Nouvelle commande…" };
  it("lireMessages fabrique le lien du bouton avec CONFIRMATION_SECRET", () => {
    const [m] = lireMessages([ligne], "secret-confirmation-de-test", Date.UTC(2026, 9, 9));
    expect(m.parametres).toEqual(["15", "Samia", "2", "8 700 DA"]);
    expect(m.bouton?.startsWith(`${ID}.`)).toBe(true);
  });
  it("sans secret : ancien modèle sans bouton", () => {
    const [m] = lireMessages([ligne], null);
    expect(m.modele).toBe("oranpromo_nouvelle_commande"); expect(m.bouton).toBeUndefined(); expect(m.parametres).toHaveLength(4);
  });
  it("Meta : composant bouton lien (index 0) avec le lien en paramètre", () => {
    const corps = corpsMessageMeta({ ...message, modele: "oranpromo_nouvelle_commande_confirmer", parametres: ["15", "Samia", "2", "8 700 DA"], bouton: "lien-signe" }, "fr");
    expect(corps.template.components).toEqual([
      { type: "body", parameters: ["15", "Samia", "2", "8 700 DA"].map(text => ({ type: "text", text })) },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "lien-signe" }] },
    ]);
  });
});

describe("US-23 : modèles arabes chez Meta", () => {
  it("modèle « _ar » : langue « ar » ; les autres gardent la langue configurée (repli français)", () => {
    expect(langueModeleMeta("oranpromo_commande_prete_ar", "fr")).toBe("ar");
    expect(langueModeleMeta("oranpromo_commande_prete", "fr")).toBe("fr");
    expect(langueModeleMeta("oranpromo_nouvelle_commande", "fr")).toBe("fr");
    const corps = corpsMessageMeta({ id: "m", reservation: "r", destinataire: "+213555123456", modele: "oranpromo_commande_prete_ar", parametres: ["Samir", "12", "Boutique Nour", "10/10 على 16:10"], texte: "" }, "fr");
    expect(corps.template).toMatchObject({ name: "oranpromo_commande_prete_ar", language: { code: "ar" } });
    expect(corps.template.components[0]).toEqual({ type: "body", parameters: ["Samir", "12", "Boutique Nour", "10/10 على 16:10"].map(text => ({ type: "text", text })) });
  });
});
