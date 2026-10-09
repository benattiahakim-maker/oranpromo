import { NextResponse } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";
import { cheminSuite } from "@/lib/connexion";
import { origineRequete } from "@/lib/origine";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origine = origineRequete(request);
  const code = url.searchParams.get("code");
  const suite = cheminSuite(url.searchParams.get("suite"));
  if (code && suite && !url.searchParams.has("error")) {
    try {
      const supabase = await creerClientServeur();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const reponse = NextResponse.redirect(new URL(suite, origine));
        reponse.headers.set("Cache-Control", "private, no-store");
        return reponse;
      }
    } catch { /* Lien invalide ou service temporairement indisponible. */ }
  }
  const reponse = NextResponse.redirect(new URL("/espace/connexion?erreur=lien", origine));
  reponse.headers.set("Cache-Control", "private, no-store");
  return reponse;
}
