import type { Metadata } from "next";
import { villeLue } from "./ville";
import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import type { Database } from "./supabase/types";

/** US-22 : lien public de la boutique, partage et QR code. */

export const LONGUEUR_MAX_SLUG = 60;
const LONGUEUR_BASE_SLUG = 50; // laisse la place à un suffixe « -2 » ou « -a1b2c3 »
const SITE_PAR_DEFAUT = "http://localhost:3000";

/** Même règle que la contrainte boutiques_slug_lisible de la base. */
export function slugValide(slug: string): boolean {
  return slug.length >= 2 && slug.length <= LONGUEUR_MAX_SLUG && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/** Base du slug coupée pour garder la place d'un suffixe, sans tiret final. */
export function baseSlug(slug: string): string {
  const base = slug.slice(0, LONGUEUR_BASE_SLUG).replace(/-+$/g, "");
  return base.length >= 2 ? base : "boutique";
}

/** Candidats essayés à la création : nom, nom-2 … nom-9, puis nom-<6 caractères aléatoires>. */
export function candidatSlug(base: string, tentative: number, aleatoire: () => string = () => crypto.randomUUID().replace(/-/g, "").slice(0, 6)): string {
  if (tentative <= 0) return base;
  if (tentative <= 8) return `${base}-${tentative + 1}`;
  return `${base}-${aleatoire()}`;
}

/** Adresse publique du site, sans « / » final. */
export function adresseSite(siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  try {
    const url = new URL(siteUrl || SITE_PAR_DEFAUT);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocole");
    return url.origin;
  } catch { return SITE_PAR_DEFAUT; }
}

/** Lien absolu, court et stable de la vitrine : https://<site>/b/<slug>. */
export function lienBoutique(slug: string, siteUrl?: string): string {
  return `${adresseSite(siteUrl)}/b/${encodeURIComponent(slug)}`;
}

// US-30.1 : ville de la boutique (Oran par défaut, comme avant).
export function messagePartageBoutique(nom: string, lien: string, ville = "Oran"): string {
  return `Découvrez ${nom} sur BleDeal : nos articles et nos promos à ${ville}, à réserver sur WhatsApp. ${lien}`;
}

/** Partage sur WhatsApp sans destinataire : le commerçant choisit le contact, le groupe ou son statut. */
export function lienPartageWhatsApp(nom: string, lien: string, ville = "Oran"): string {
  return `https://wa.me/?text=${encodeURIComponent(messagePartageBoutique(nom, lien, ville))}`;
}

/** Description de l'aperçu (WhatsApp, Facebook…) : quartier et nombre d'articles disponibles. */
// US-29.3 : ville de la boutique (Oran comme avant ; null : nom de ville illisible, ville fermée).
export function descriptionBoutique(quartier: string, nombreArticles: number | null, ville: string | null = "Oran"): string {
  const lieu = ville ? `Boutique à ${quartier.trim() || ville}, ${ville}` : `Boutique à ${quartier.trim() || "Algérie"}`;
  if (nombreArticles === null) return `${lieu}. Réservez sur WhatsApp, payez en boutique.`;
  const articles = nombreArticles === 0 ? "nouveaux articles bientôt" : `${nombreArticles} article${nombreArticles > 1 ? "s" : ""} disponible${nombreArticles > 1 ? "s" : ""}`;
  return `${lieu} · ${articles}. Réservez sur WhatsApp, payez en boutique.`;
}

/** Nom de fichier du QR code téléchargé. */
export function nomFichierQrCode(slug: string): string {
  return `bledeal-${slug}-qr.svg`;
}

/** QR code SVG noir sur blanc, généré localement (aucun service externe). Serveur seulement. */
export async function qrCodeSvg(texte: string): Promise<string> {
  return QRCode.toString(texte, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
}

/** Image de repli de l'aperçu (boutique sans photo d'article), générée par app/b/[slug]/apercu. */
export function cheminImageApercu(slug: string): string {
  return `/b/${encodeURIComponent(slug)}/apercu`;
}

export type ApercuBoutique = { nom: string; quartier: string; ville: string | null; slug: string; photo: string | null; nombreArticles: number | null };

/** Métadonnées de la vitrine : Open Graph (WhatsApp, Facebook, Instagram) et Twitter/X. */
export function metadonneesBoutique({ nom, quartier, ville, slug, photo, nombreArticles }: ApercuBoutique): Metadata {
  const description = descriptionBoutique(quartier, nombreArticles, ville);
  const chemin = `/b/${encodeURIComponent(slug)}`;
  const image = photo ? { url: photo, alt: nom } : { url: cheminImageApercu(slug), width: 1200, height: 630, alt: nom, type: "image/png" };
  return {
    title: nom,
    description,
    alternates: { canonical: chemin },
    openGraph: { title: nom, description, url: chemin, siteName: "BleDeal", locale: "fr_FR", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: nom, description, images: [{ url: image.url, alt: nom }] },
  };
}

export const METADONNEES_BOUTIQUE_INDISPONIBLE: Metadata = { title: "Boutique indisponible", robots: { index: false, follow: false } };

/** Lit ce qu'il faut pour l'aperçu d'une boutique validée (null sinon). La RLS ne renvoie de toute façon que les boutiques validées au public. */
export async function chargerApercuBoutique(client: SupabaseClient<Database>, slug: string): Promise<ApercuBoutique | null> {
  if (!slugValide(slug)) return null;
  const { data: boutique } = await client.from("boutiques").select("id, nom, quartier, villes(nom)").eq("slug", slug).eq("statut", "validee").maybeSingle();
  if (!boutique) return null;
  const [dernier, compte] = await Promise.all([
    client.from("articles").select("photos(adresse, ordre)").eq("boutique_id", boutique.id).eq("statut", "disponible").order("cree_le", { ascending: false }).limit(1),
    client.from("articles").select("id", { count: "exact", head: true }).eq("boutique_id", boutique.id).eq("statut", "disponible"),
  ]);
  const photo = [...(dernier.data?.[0]?.photos ?? [])].sort((a, b) => a.ordre - b.ordre)[0];
  return { nom: boutique.nom, quartier: boutique.quartier, ville: villeLue(boutique.villes)?.nom ?? null, slug, photo: photo?.adresse ?? null, nombreArticles: compte.error ? null : compte.count ?? null };
}

/** Adresse data: d'un SVG, pour l'afficher (<img>) ou le télécharger sans le recopier en HTML. */
export function adresseDonneesSvg(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// US-30.1 : « ville » = nom de la ville de la boutique (affiche « BleDeal · Oran », message de partage) ; Oran par défaut.
export type PartageBoutique = { nom: string; slug: string; statut: "en_attente" | "validee" | "suspendue"; lien: string; lienWhatsApp: string | null; qrCode: string | null; fichierQrCode: string; ville: string };

/** Tout ce que le bloc « Partager ma boutique » affiche ; lien WhatsApp et QR code seulement pour une boutique validée. */
export async function preparerPartageBoutique(boutique: { nom: string; slug: string; statut: PartageBoutique["statut"]; ville?: string | null }, siteUrl?: string): Promise<PartageBoutique> {
  const lien = lienBoutique(boutique.slug, siteUrl);
  const validee = boutique.statut === "validee";
  const ville = boutique.ville || "Oran";
  return { nom: boutique.nom, slug: boutique.slug, statut: boutique.statut, lien, lienWhatsApp: validee ? lienPartageWhatsApp(boutique.nom, lien, ville) : null, qrCode: validee ? adresseDonneesSvg(await qrCodeSvg(lien)) : null, fichierQrCode: nomFichierQrCode(boutique.slug), ville };
}
