import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { annulerNoShow, aUneContestationEnAttente, bloquerClient, contesterNoShow, delaiContestationDepasse, erreurMotifContestation, etatContestation, listerContestationsEnAttente, listerMesNoShows, nettoyerMotifContestation, validerNoShow, debloquerClient, grouperNumerosPartages, listerNumerosPartages, listerClientsSurveilles, listerNoShowsDeclares, nettoyerNom, nomValide, noShowsDuClient, enregistrerNomClient, enregistrerProfilClient, ErreurValidationProfil, essaisRestants, messageNoShows, profilComplet, telephoneLisible, validerProfilClient } from "./clients";

describe("profil client (US-20.2, US-20.4)", () => {
  it("compte les essais restants avant le blocage au 5e no-show", () => {
    expect([0, 1, 4, 5, 7].map(essaisRestants)).toEqual([5, 4, 1, 0, 0]);
    expect(messageNoShows(0, false)).toBeNull();
    expect(messageNoShows(1, false)).toBe("Attention : 1 commande non récupérée. Il vous reste 4 essais avant le blocage de votre compte.");
    expect(messageNoShows(4, false)).toContain("Il vous reste 1 essai avant");
    expect(messageNoShows(5, true)).toContain("bloqué");
  });
  it("valide le nom et le numéro algérien", () => {
    expect(validerProfilClient({ nom: "Samia", telephone: "0555 12 34 56" })).toEqual({});
    expect(Object.keys(validerProfilClient({ nom: " S ", telephone: "12345" }))).toEqual(["nom", "telephone"]);
    expect(profilComplet({ nom: "Samia", telephone: "+213555123456" })).toBe(true);
    expect(profilComplet({ nom: "Samia", telephone: null })).toBe(false);
    expect(telephoneLisible("+213555123456")).toBe("0555 12 34 56");
  });
  it("enregistre le nom et le numéro normalisé", async () => {
    const update = vi.fn(); const eq = vi.fn();
    const chaine = { update: (v: unknown) => { update(v); return chaine; }, eq: (...a: unknown[]) => { eq(...a); return chaine; }, select: () => chaine, maybeSingle: async () => ({ data: { id: "moi" }, error: null }) };
    const client = { auth: { getUser: async () => ({ data: { user: { id: "moi" } }, error: null }) }, from: () => chaine } as unknown as SupabaseClient<Database>;
    await enregistrerProfilClient(client, { nom: " Samia  Ben ", telephone: "0555 12 34 56" });
    expect(update).toHaveBeenCalledWith({ nom: "Samia Ben", telephone: "+213555123456" });
    expect(eq).toHaveBeenCalledWith("id", "moi");
    await expect(enregistrerProfilClient(client, { nom: "", telephone: "" })).rejects.toBeInstanceOf(ErreurValidationProfil);
  });
});

describe("clients à surveiller (US-20.4)", () => {
  it("sépare les clients bloqués de ceux qui ont des no-shows", async () => {
    const appels: unknown[][] = [];
    const chaine: Record<string, unknown> = {};
    for (const m of ["select", "or", "order"]) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return chaine; };
    chaine.limit = async () => ({ data: [{ id: "a", bloque: true, no_shows: 5 }, { id: "b", bloque: false, no_shows: 2 }], error: null });
    const resultat = await listerClientsSurveilles({ from: () => chaine } as unknown as SupabaseClient<Database>);
    expect(resultat.bloques.map(c => c.id)).toEqual(["a"]);
    expect(resultat.avecNoShows.map(c => c.id)).toEqual(["b"]);
    expect(appels).toContainEqual(["or", "bloque.eq.true,no_shows.gt.0"]);
  });
  it("débloque par la fonction de la base et relaie le refus", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await debloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k1");
    expect(rpc).toHaveBeenCalledWith("debloquer_client", { client: "k1" });
    rpc.mockResolvedValue({ error: { code: "42501", message: "Action réservée aux administrateurs." } });
    await expect(debloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k1")).rejects.toThrow("Action réservée aux administrateurs.");
    rpc.mockResolvedValue({ error: { code: "XX000", message: "interne" } });
    await expect(debloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k1")).rejects.toThrow("Impossible de débloquer");
  });
});

describe("relecture point 4 : nom sans lien ni numéro (même règle que la base)", () => {
  it("accepte les lettres latines avec accents, l’arabe, les espaces, l’apostrophe et le tiret", () => {
    for (const nom of ["Samia", "Éloïse d’Arc-Ben Ali", "N'Guessan", "كريم بن علي", "Zoé"]) expect(nomValide(nom), nom).toBe(true);
    expect(nettoyerNom("  Samia   Ben  Ali ")).toBe("Samia Ben Ali");
  });
  it("refuse les liens, les chiffres, les retours à la ligne et les noms trop longs", () => {
    for (const nom of ["Samia https://x.co", "Samia www.x.co", "Samia 0555", "Samia\nCliquez ici", "Samia٣", "Sam@ia", "a".repeat(61), "--", "S"]) expect(nomValide(nom), nom).toBe(false);
    expect(validerProfilClient({ nom: "Samia https://x.co", telephone: "0555 12 34 56" }).nom).toContain("que des lettres");
    expect(validerProfilClient({ nom: "a".repeat(61), telephone: "0555 12 34 56" }).nom).toContain("entre 2 et 60");
  });
  it("affiche le refus de la base en français", async () => {
    const chaine = { update: () => chaine, eq: () => chaine, select: () => chaine, maybeSingle: async () => ({ data: null, error: { code: "23514", message: "Nom invalide : lettres, espaces, apostrophe et tiret seulement." } }) };
    const client = { auth: { getUser: async () => ({ data: { user: { id: "moi" } }, error: null }) }, from: () => chaine } as unknown as SupabaseClient<Database>;
    await expect(enregistrerProfilClient(client, { nom: "Samia", telephone: "0555 12 34 56" })).rejects.toThrow("Nom invalide");
  });
});

describe("relecture point 11 : no-shows déclarés (admin)", () => {
  it("liste les no-shows non annulés et les rattache au compte ou au numéro", async () => {
    const appels: unknown[][] = [];
    const chaine: Record<string, unknown> = {};
    for (const m of ["select", "not", "is", "order"]) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return chaine; };
    chaine.limit = async () => ({ data: [{ id: "c1", numero: 3, client_id: "k1", client_telephone: "+213555000001", no_show_le: "2026-10-09T10:00:00Z", boutiques: { nom: "B" } }, { id: "c2", numero: 4, client_id: "k9", client_telephone: "+213555000002", no_show_le: "2026-10-09T11:00:00Z", boutiques: null }], error: null });
    const client = { from: (t: string) => { appels.push(["from", t]); return chaine; } } as unknown as SupabaseClient<Database>;
    const liste = await listerNoShowsDeclares(client);
    expect(appels).toContainEqual(["from", "commandes"]);
    expect(appels).toContainEqual(["not", "no_show_le", "is", null]);
    expect(appels).toContainEqual(["is", "no_show_annule_le", null]);
    // Relecture n°2 : seulement les commandes du compte, pas celles d’un autre compte avec le même numéro.
    expect(noShowsDuClient({ id: "k1" }, liste).map(n => n.id)).toEqual(["c1"]);
    expect(noShowsDuClient({ id: "k5" }, liste)).toEqual([]);
  });
  it("annule un no-show par la fonction de la base", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await annulerNoShow({ rpc } as unknown as SupabaseClient<Database>, "c1");
    expect(rpc).toHaveBeenCalledWith("annuler_no_show", { commande: "c1" });
    rpc.mockResolvedValue({ error: { code: "42501", message: "Action réservée aux administrateurs." } });
    await expect(annulerNoShow({ rpc } as unknown as SupabaseClient<Database>, "c1")).rejects.toThrow("administrateurs");
  });
});

describe("relecture n°2 US-20 : numéro non vérifié", () => {
  it("n’affiche que le compteur du compte, et un message neutre pour un blocage décidé par l’admin", () => {
    expect(messageNoShows(0, true)).toBe("Votre compte est bloqué : vous ne pouvez plus commander. Contactez OranPromo pour le débloquer.");
    expect(messageNoShows(2, true)).not.toContain("5 commandes");
    expect(messageNoShows(5, true)).toContain("après 5 commandes non récupérées");
  });
  it("regroupe les comptes par numéro partagé", () => {
    const lignes = [
      { telephone: "+213555000001", client_id: "k1", nom: "Fraudeur", telephone_actuel: "+213555000001", no_shows: 5, bloque: true, no_shows_numero: 5 },
      { telephone: "+213555000001", client_id: "k2", nom: "Victime", telephone_actuel: "+213555000001", no_shows: 0, bloque: false, no_shows_numero: 5 },
      { telephone: "+213555000001", client_id: "k2", nom: "Victime", telephone_actuel: "+213555000001", no_shows: 0, bloque: false, no_shows_numero: 5 },
      { telephone: "+213555000009", client_id: "k9", nom: "Seul", telephone_actuel: "+213555000009", no_shows: 1, bloque: false, no_shows_numero: 1 },
    ];
    expect(grouperNumerosPartages(lignes)).toEqual([{ telephone: "+213555000001", noShowsNumero: 5, comptes: [
      { id: "k1", nom: "Fraudeur", telephoneActuel: "+213555000001", noShows: 5, bloque: true },
      { id: "k2", nom: "Victime", telephoneActuel: "+213555000001", noShows: 0, bloque: false },
    ] }]);
    expect(grouperNumerosPartages([])).toEqual([]);
  });
  it("lit les numéros partagés par la fonction de la base (admin)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [
      { telephone: "+213555000001", client_id: "k1", nom: null, telephone_actuel: null, no_shows: 2, bloque: false, no_shows_numero: 3 },
      { telephone: "+213555000001", client_id: "k2", nom: "B", telephone_actuel: "+213555000001", no_shows: 1, bloque: false, no_shows_numero: 3 },
    ], error: null });
    const resultat = await listerNumerosPartages({ rpc } as unknown as SupabaseClient<Database>);
    expect(rpc).toHaveBeenCalledWith("numeros_partages");
    expect(resultat[0].comptes.map(c => c.id)).toEqual(["k1", "k2"]);
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Action réservée aux administrateurs." } });
    await expect(listerNumerosPartages({ rpc } as unknown as SupabaseClient<Database>)).rejects.toThrow("Impossible de charger les numéros partagés");
  });
  it("bloque un compte par la fonction de la base et relaie le refus", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await bloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k2");
    expect(rpc).toHaveBeenCalledWith("bloquer_client", { client: "k2" });
    rpc.mockResolvedValue({ error: { code: "P0002", message: "Client introuvable." } });
    await expect(bloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k2")).rejects.toThrow("Client introuvable.");
    rpc.mockResolvedValue({ error: { code: "XX000", message: "interne" } });
    await expect(bloquerClient({ rpc } as unknown as SupabaseClient<Database>, "k2")).rejects.toThrow("Impossible de bloquer");
  });
});

describe("contestation d’un no-show (migration 20261009234500)", () => {
  it("motif court nettoyé, 5 à 300 caractères (même règle que la base)", () => {
    expect(nettoyerMotifContestation("  Je suis   venue\n samedi ")).toBe("Je suis venue samedi");
    expect(erreurMotifContestation("Je suis venue samedi")).toBeNull();
    expect(erreurMotifContestation("  ok  ")).toContain("5 à 300 caractères");
    expect(erreurMotifContestation("a".repeat(301))).toContain("5 à 300 caractères");
    expect(erreurMotifContestation("a".repeat(300))).toBeNull();
  });
  it("donne l’état de la contestation", () => {
    expect(etatContestation({ contestee_le: null, contestation_validee_le: null })).toBe("a_contester");
    expect(etatContestation({ contestee_le: "2026-10-09T10:00:00Z", contestation_validee_le: null })).toBe("en_attente");
    expect(etatContestation({ contestee_le: "2026-10-09T10:00:00Z", contestation_validee_le: "2026-10-10T10:00:00Z" })).toBe("refusee");
  });
  it("liste les no-shows non annulés du compte connecté", async () => {
    const appels: unknown[][] = [];
    const chaine: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "is", "order"]) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return chaine; };
    chaine.limit = async () => ({ data: [{ id: "c1" }], error: null });
    const client = { auth: { getUser: async () => ({ data: { user: { id: "moi" } }, error: null }) }, from: (t: string) => { appels.push(["from", t]); return chaine; } } as unknown as SupabaseClient<Database>;
    expect((await listerMesNoShows(client)).map(n => n.id)).toEqual(["c1"]);
    expect(appels).toContainEqual(["eq", "client_id", "moi"]);
    expect(appels).toContainEqual(["not", "no_show_le", "is", null]);
    expect(appels).toContainEqual(["is", "no_show_annule_le", null]);
    const sansCompte = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as unknown as SupabaseClient<Database>;
    expect(await listerMesNoShows(sansCompte)).toEqual([]);
  });
  it("conteste par la fonction de la base, refuse un motif invalide sans appeler la base, relaie les refus", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    await contesterNoShow(client, "c1", "  La boutique   était fermée ");
    expect(rpc).toHaveBeenCalledWith("contester_no_show", { commande: "c1", motif: "La boutique était fermée" });
    rpc.mockClear();
    await expect(contesterNoShow(client, "c1", "ok")).rejects.toThrow("5 à 300 caractères");
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ error: { code: "23514", message: "Vous avez déjà contesté ce no-show." } });
    await expect(contesterNoShow(client, "c1", "Encore une fois")).rejects.toThrow("déjà contesté");
    rpc.mockResolvedValue({ error: { code: "XX000", message: "interne" } });
    await expect(contesterNoShow(client, "c1", "Encore une fois")).rejects.toThrow("Impossible d’envoyer votre contestation");
  });
  it("liste les contestations en attente pour l’admin et valide un no-show", async () => {
    const appels: unknown[][] = [];
    const chaine: Record<string, unknown> = {};
    for (const m of ["select", "not", "is", "order"]) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return chaine; };
    chaine.limit = async () => ({ data: [{ id: "c1" }], error: null });
    const liste = await listerContestationsEnAttente({ from: () => chaine } as unknown as SupabaseClient<Database>);
    expect(liste.map(c => c.id)).toEqual(["c1"]);
    expect(appels).toContainEqual(["not", "contestee_le", "is", null]);
    expect(appels).toContainEqual(["is", "contestation_validee_le", null]);
    expect(appels).toContainEqual(["is", "no_show_annule_le", null]);
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await validerNoShow({ rpc } as unknown as SupabaseClient<Database>, "c1");
    expect(rpc).toHaveBeenCalledWith("valider_no_show", { commande: "c1" });
    rpc.mockResolvedValue({ error: { code: "P0002", message: "Aucune contestation en attente sur cette commande." } });
    await expect(validerNoShow({ rpc } as unknown as SupabaseClient<Database>, "c1")).rejects.toThrow("Aucune contestation");
  });
});

describe("règles de la contestation (migration 20261009235500)", () => {
  it("7 jours pour contester après la déclaration", () => {
    const declare = "2026-10-01T10:00:00Z";
    expect(delaiContestationDepasse({ no_show_le: declare }, Date.parse("2026-10-08T09:59:00Z"))).toBe(false);
    expect(delaiContestationDepasse({ no_show_le: declare }, Date.parse("2026-10-08T10:01:00Z"))).toBe(true);
    expect(delaiContestationDepasse({ no_show_le: null }, Date.parse("2026-10-02T10:00:00Z"))).toBe(true);
  });
  it("repère une contestation déjà en attente", () => {
    expect(aUneContestationEnAttente([{ contestee_le: null, contestation_validee_le: null }])).toBe(false);
    expect(aUneContestationEnAttente([{ contestee_le: "2026-10-01T10:00:00Z", contestation_validee_le: "2026-10-02T10:00:00Z" }])).toBe(false);
    expect(aUneContestationEnAttente([{ contestee_le: null, contestation_validee_le: null }, { contestee_le: "2026-10-01T10:00:00Z", contestation_validee_le: null }])).toBe(true);
  });
  it("lit le motif dans la table contestations (pas dans commandes, que lit la boutique)", async () => {
    const appels: unknown[][] = [];
    const chaine: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "is", "order"]) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return chaine; };
    chaine.limit = async () => ({ data: [], error: null });
    const client = { auth: { getUser: async () => ({ data: { user: { id: "moi" } }, error: null }) }, from: () => chaine } as unknown as SupabaseClient<Database>;
    await listerMesNoShows(client);
    await listerContestationsEnAttente(client);
    const selections = appels.filter(a => a[0] === "select").map(a => String(a[1]));
    expect(selections).toHaveLength(2);
    for (const s of selections) { expect(s).toContain("contestations(motif)"); expect(s).not.toContain("contestation_motif"); }
  });
});

describe("US-21.2 : numéro vérifié", () => {
  it("en mode téléphone, un profil complet a un numéro vérifié", () => {
    expect(profilComplet({ nom: "Samia", telephone: "+213555123456", telephone_verifie_le: null }, true)).toBe(false);
    expect(profilComplet({ nom: "Samia", telephone: "+213555123456", telephone_verifie_le: "2026-10-10T08:00:00Z" }, true)).toBe(true);
    expect(profilComplet({ nom: null, telephone: "+213555123456", telephone_verifie_le: "2026-10-10T08:00:00Z" }, true)).toBe(false);
    expect(profilComplet({ nom: "Samia", telephone: "+213555123456", telephone_verifie_le: null })).toBe(true);
  });
  it("enregistre le nom seul, sans toucher au numéro", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "u1" }, error: null });
    const update = vi.fn(() => ({ eq: () => ({ select: () => ({ maybeSingle }) }) }));
    const client = { auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) }, from: () => ({ update }) } as unknown as SupabaseClient<Database>;
    await enregistrerNomClient(client, "  Samia   B ");
    expect(update).toHaveBeenCalledWith({ nom: "Samia B" });
    await expect(enregistrerNomClient(client, "S4mia")).rejects.toBeInstanceOf(ErreurValidationProfil);
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "Nom invalide : lettres…" } });
    await expect(enregistrerNomClient(client, "Samia")).rejects.toThrow("Nom invalide");
  });
});
