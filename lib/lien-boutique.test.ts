import { describe, expect, it, vi } from "vitest";
import { adresseSite, preparerPartageBoutique, baseSlug, candidatSlug, chargerApercuBoutique, cheminImageApercu, METADONNEES_BOUTIQUE_INDISPONIBLE, metadonneesBoutique, descriptionBoutique, lienBoutique, lienPartageWhatsApp, messagePartageBoutique, nomFichierQrCode, qrCodeSvg, slugValide } from "./lien-boutique";
import { slugBoutique } from "./boutique";

describe("US-22 : slug de la boutique", () => {
  it.each(["boutique-nour", "maison-ilyes", "b2", "boutique-etoile-2", "a".repeat(60)])("accepte %s", slug => expect(slugValide(slug)).toBe(true));
  it.each(["", "a", "-nour", "nour-", "nour--oran", "Nour", "noûr", "nour oran", "nour_oran", "a".repeat(61), "nour/oran"])("refuse « %s »", slug => expect(slugValide(slug)).toBe(false));
  it("coupe la base à 50 caractères sans tiret final, et garde un repli pour un nom trop court", () => {
    const base = baseSlug(slugBoutique("La Très Grande Maison de la Mode Oranaise du Front de Mer"));
    expect(base.length).toBeLessThanOrEqual(50); expect(base.endsWith("-")).toBe(false); expect(slugValide(base)).toBe(true);
    expect(baseSlug(slugBoutique("X"))).toBe("boutique"); expect(baseSlug(slugBoutique("متجر نور"))).toBe("boutique");
  });
  it("propose nom, nom-2 … nom-9 puis un suffixe aléatoire", () => {
    expect(candidatSlug("nour", 0)).toBe("nour"); expect(candidatSlug("nour", 1)).toBe("nour-2"); expect(candidatSlug("nour", 8)).toBe("nour-9");
    expect(candidatSlug("nour", 9, () => "a1b2c3")).toBe("nour-a1b2c3"); expect(candidatSlug("nour", 10)).toMatch(/^nour-[0-9a-f]{6}$/);
    expect(slugValide(candidatSlug("a".repeat(50), 10))).toBe(true);
  });
});

describe("US-22 : lien public et partage", () => {
  it("construit un lien absolu à partir de l’adresse du site", () => {
    expect(lienBoutique("boutique-nour", "https://oranpromo.com")).toBe("https://oranpromo.com/b/boutique-nour");
    expect(lienBoutique("boutique-nour", "https://oranpromo.com/")).toBe("https://oranpromo.com/b/boutique-nour");
    expect(lienBoutique("boutique-nour", "https://oranpromo.com/chemin?x=1")).toBe("https://oranpromo.com/b/boutique-nour");
  });
  it("revient à localhost si l’adresse du site est absente ou invalide", () => {
    expect(adresseSite("")).toBe("http://localhost:3000"); expect(adresseSite("pas une adresse")).toBe("http://localhost:3000"); expect(adresseSite("javascript:alert(1)")).toBe("http://localhost:3000");
  });
  it("prépare un partage WhatsApp sans destinataire, avec le message et le lien encodés", () => {
    const lien = "https://oranpromo.com/b/l-etoile";
    expect(messagePartageBoutique("L’Étoile & Co", lien)).toContain(lien);
    const url = new URL(lienPartageWhatsApp("L’Étoile & Co", lien));
    expect(url.origin + url.pathname).toBe("https://wa.me/"); expect(url.searchParams.get("text")).toBe(messagePartageBoutique("L’Étoile & Co", lien));
  });
  it("décrit la boutique pour l’aperçu", () => {
    expect(descriptionBoutique("Akid Lotfi", 12)).toBe("Boutique à Akid Lotfi, Oran · 12 articles disponibles. Réservez sur WhatsApp, payez en boutique.");
    expect(descriptionBoutique("Akid Lotfi", 1)).toContain("1 article disponible.");
    expect(descriptionBoutique("Akid Lotfi", 0)).toContain("nouveaux articles bientôt");
    expect(descriptionBoutique("Akid Lotfi", null)).toBe("Boutique à Akid Lotfi, Oran. Réservez sur WhatsApp, payez en boutique.");
  });
  it("nomme le fichier du QR code d’après le slug", () => expect(nomFichierQrCode("boutique-nour")).toBe("bledeal-boutique-nour-qr.svg"));
});

describe("US-22 : QR code", () => {
  it("génère un SVG local noir sur blanc, différent selon le lien", async () => {
    const svg = await qrCodeSvg("https://oranpromo.com/b/boutique-nour");
    expect(svg.startsWith("<svg")).toBe(true); expect(svg).toContain("#0A0A0A"); expect(svg).toContain("#FFFFFF"); expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(await qrCodeSvg("https://oranpromo.com/b/maison-ilyes")).not.toBe(svg);
  });
});

describe("US-22 : aperçu de la vitrine", () => {
  it("utilise la grande photo du dernier article, avec Open Graph, Twitter et l’adresse canonique", () => {
    const m = metadonneesBoutique({ nom: "Boutique Nour", quartier: "Akid Lotfi", ville: "Oran", slug: "boutique-nour", photo: "https://x.supabase.co/storage/v1/object/public/photos/b/a/1.jpg", nombreArticles: 3 });
    expect(m.title).toBe("Boutique Nour"); expect(m.description).toContain("3 articles disponibles");
    expect(m.alternates?.canonical).toBe("/b/boutique-nour");
    expect(m.openGraph).toMatchObject({ title: "Boutique Nour", url: "/b/boutique-nour", siteName: "BleDeal", locale: "fr_FR", type: "website", images: [{ url: "https://x.supabase.co/storage/v1/object/public/photos/b/a/1.jpg", alt: "Boutique Nour" }] });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: "Boutique Nour", images: [{ url: "https://x.supabase.co/storage/v1/object/public/photos/b/a/1.jpg" }] });
  });
  it("sans photo, renvoie vers l’image générée de 1200 × 630", () => {
    const m = metadonneesBoutique({ nom: "Boutique Nour", quartier: "Akid Lotfi", ville: "Oran", slug: "boutique-nour", photo: null, nombreArticles: 0 });
    expect(m.openGraph?.images).toEqual([expect.objectContaining({ url: "/b/boutique-nour/apercu", width: 1200, height: 630 })]);
    expect(cheminImageApercu("boutique-nour")).toBe("/b/boutique-nour/apercu");
  });
  it("une boutique indisponible n’est pas indexée", () => expect(METADONNEES_BOUTIQUE_INDISPONIBLE.robots).toEqual({ index: false, follow: false }));
});

describe("US-22 : lecture de l’aperçu", () => {
  function client(boutique: unknown, photos: unknown[] = [], count: number | null = 2) {
    const eqBoutique = vi.fn();
    const requeteBoutique = { eq: (...args: unknown[]) => { eqBoutique(...args); return requeteBoutique; }, maybeSingle: async () => ({ data: boutique, error: null }) };
    const requeteArticles = { eq: () => requeteArticles, order: () => requeteArticles, limit: async () => ({ data: [{ photos }], error: null }), then: (ok: (v: unknown) => void) => ok({ count, error: null }) };
    const from = vi.fn((table: string) => ({ select: () => table === "boutiques" ? requeteBoutique : requeteArticles }));
    return { client: { from } as unknown as Parameters<typeof chargerApercuBoutique>[0], from, eqBoutique };
  }
  it("ne lit qu’une boutique validée, au slug valide", async () => {
    const test = client(null); expect(await chargerApercuBoutique(test.client, "boutique-nour")).toBeNull();
    expect(test.eqBoutique).toHaveBeenCalledWith("slug", "boutique-nour"); expect(test.eqBoutique).toHaveBeenCalledWith("statut", "validee");
    const invalide = client({ id: "b" }); expect(await chargerApercuBoutique(invalide.client, "Nour--x")).toBeNull(); expect(invalide.from).not.toHaveBeenCalled();
  });
  it("prend la première photo du dernier article et le nombre d’articles disponibles", async () => {
    const test = client({ id: "b", nom: "Boutique Nour", quartier: "Akid Lotfi", villes: { nom: "Oran" } }, [{ adresse: "https://p/2.jpg", ordre: 2 }, { adresse: "https://p/1.jpg", ordre: 1 }], 4);
    expect(await chargerApercuBoutique(test.client, "boutique-nour")).toEqual({ nom: "Boutique Nour", quartier: "Akid Lotfi", ville: "Oran", slug: "boutique-nour", photo: "https://p/1.jpg", nombreArticles: 4 });
  });
});

describe("US-22 : bloc de partage", () => {
  it("prépare lien, WhatsApp et QR code pour une boutique validée", async () => {
    const partage = await preparerPartageBoutique({ nom: "Boutique Nour", slug: "boutique-nour", statut: "validee" }, "https://oranpromo.com");
    expect(partage.lien).toBe("https://oranpromo.com/b/boutique-nour"); expect(partage.lienWhatsApp).toBe(lienPartageWhatsApp("Boutique Nour", partage.lien));
    expect(partage.qrCode).toMatch(/^data:image\/svg\+xml;charset=utf-8,%3Csvg/); expect(partage.fichierQrCode).toBe("bledeal-boutique-nour-qr.svg");
  });
  it.each(["en_attente", "suspendue"] as const)("ne prépare ni WhatsApp ni QR code pour une boutique %s", async statut => {
    const partage = await preparerPartageBoutique({ nom: "Boutique Nour", slug: "boutique-nour", statut }, "https://oranpromo.com");
    expect(partage.lienWhatsApp).toBeNull(); expect(partage.qrCode).toBeNull(); expect(partage.lien).toBe("https://oranpromo.com/b/boutique-nour");
  });
});

describe("US-29.3 : ville dans l'aperçu", () => {
  it("« Boutique à Kiffane, Tlemcen » ; Oran comme avant ; ville illisible (fermée) : sans ville", () => {
    expect(descriptionBoutique("Kiffane", 2, "Tlemcen")).toBe("Boutique à Kiffane, Tlemcen · 2 articles disponibles. Réservez sur WhatsApp, payez en boutique.");
    expect(descriptionBoutique("Akid Lotfi", null)).toBe("Boutique à Akid Lotfi, Oran. Réservez sur WhatsApp, payez en boutique.");
    expect(descriptionBoutique("Kiffane", null, null)).toBe("Boutique à Kiffane. Réservez sur WhatsApp, payez en boutique.");
  });
});

describe("US-30.1 : BleDeal et ville dans le partage", () => {
  it("message de partage : BleDeal et la ville de la boutique (Oran par défaut)", () => {
    expect(messagePartageBoutique("Boutique Nour", "https://bledeal.com/b/boutique-nour")).toBe("Découvrez Boutique Nour sur BleDeal : nos articles et nos promos à Oran, à réserver sur WhatsApp. https://bledeal.com/b/boutique-nour");
    expect(messagePartageBoutique("Kiffane Mode", "https://bledeal.com/b/kiffane-mode", "Tlemcen")).toContain("nos promos à Tlemcen");
  });
  it("bloc de partage : ville gardée pour l'affiche et le message", async () => {
    const partage = await preparerPartageBoutique({ nom: "Kiffane Mode", slug: "kiffane-mode", statut: "validee", ville: "Tlemcen" }, "https://bledeal.com");
    expect(partage.ville).toBe("Tlemcen"); expect(decodeURIComponent(partage.lienWhatsApp!)).toContain("nos promos à Tlemcen"); expect(partage.fichierQrCode).toBe("bledeal-kiffane-mode-qr.svg");
    expect((await preparerPartageBoutique({ nom: "Nour", slug: "nour", statut: "en_attente", ville: null })).ville).toBe("Oran");
  });
});
