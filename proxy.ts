import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { origineRequete } from "@/lib/origine";

export async function proxy(request: NextRequest) {
  let reponse = NextResponse.next({ request });
  const entetesCache = new Map<string, string>();
  const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        const precedents = reponse.cookies.getAll();
        reponse = NextResponse.next({ request });
        precedents.forEach(cookie => reponse.cookies.set(cookie));
        cookies.forEach(({ name, value, options }) => reponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([nom, valeur]) => entetesCache.set(nom, valeur));
        entetesCache.forEach((valeur, nom) => reponse.headers.set(nom, valeur));
      },
    },
  });
  // Vérifie la session auprès de Supabase et rafraîchit ses cookies si nécessaire.
  const { data: { user }, error } = await supabase.auth.getUser();
  const chemin = request.nextUrl.pathname;
  const protege = ((chemin === "/espace" || chemin.startsWith("/espace/")) && chemin !== "/espace/connexion" && chemin !== "/espace/connexion/") || chemin === "/admin" || chemin.startsWith("/admin/");
  if (protege && (error || !user)) {
    const url = new URL("/espace/connexion", origineRequete(request));
    const redirection = NextResponse.redirect(url);
    reponse.cookies.getAll().forEach(cookie => redirection.cookies.set(cookie));
    entetesCache.forEach((valeur, nom) => redirection.headers.set(nom, valeur));
    redirection.headers.set("Cache-Control", "private, no-store");
    return redirection;
  }
  reponse.headers.set("Cache-Control", "private, no-store");
  return reponse;
}

export const config = { matcher: ["/espace/:path*", "/admin/:path*", "/auth/callback"] };
