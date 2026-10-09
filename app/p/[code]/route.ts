import { NextResponse, type NextRequest } from "next/server";
import { origineRequete } from "@/lib/origine";
import { COOKIE_PARRAIN, DUREE_COOKIE_PARRAIN, normaliserCodeParrainage } from "@/lib/parrainage";

// US-27.2 : lien d'invitation /p/<code>. On garde le code seul (30 jours) puis on ouvre /parrainage?invite=1.
// Aucune lecture de la base : un code inconnu ou mal formé mène à la même page (rien n'est révélé).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: brut } = await params;
  let code: string | null = null;
  try { code = normaliserCodeParrainage(decodeURIComponent(brut)); } catch { code = null; }
  const reponse = NextResponse.redirect(new URL("/parrainage?invite=1", origineRequete(request)), 303);
  if (code) reponse.cookies.set(COOKIE_PARRAIN, code, { httpOnly: true, sameSite: "lax", path: "/", maxAge: DUREE_COOKIE_PARRAIN, secure: process.env.NODE_ENV === "production" });
  reponse.headers.set("Cache-Control", "private, no-store");
  reponse.headers.set("Referrer-Policy", "no-referrer");
  return reponse;
}
