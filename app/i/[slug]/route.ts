import { NextResponse, type NextRequest } from "next/server";
import { origineRequete } from "@/lib/origine";
import { COOKIE_INSCRIPTION, DUREE_COOKIE_INSCRIPTION, slugDuLien } from "@/lib/inscription-boutique";

// US-31.3 : QR code de l'affiche en boutique. On garde le slug seul (24 h) puis on ouvre la vitrine avec le bandeau
// d'accueil. Aucune lecture de la base : un slug inconnu mène à « Boutique indisponible » comme /b/<slug>.
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: brut } = await params;
  const slug = slugDuLien(brut);
  const destination = slug ? `/b/${slug}?bienvenue=1` : "/";
  const reponse = NextResponse.redirect(new URL(destination, origineRequete(request)), 303);
  if (slug) reponse.cookies.set(COOKIE_INSCRIPTION, slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: DUREE_COOKIE_INSCRIPTION, secure: process.env.NODE_ENV === "production" });
  reponse.headers.set("Cache-Control", "private, no-store");
  reponse.headers.set("Referrer-Policy", "no-referrer");
  return reponse;
}
