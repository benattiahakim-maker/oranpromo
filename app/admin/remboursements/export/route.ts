import type { NextRequest } from "next/server";
import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { csvReleves, listerReleves, moisDepuisParametre, nomFichierCsv } from "@/lib/parrainage-admin";

// US-27.5 : export CSV des relevés d'un mois (toutes les boutiques ou une seule). Admin seulement, sinon 404.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch { return new Response("Page introuvable", { status: 404, headers: { "Cache-Control": "no-store" } }); }
  const parametres = request.nextUrl.searchParams;
  const mois = moisDepuisParametre(parametres.get("mois"));
  const boutique = parametres.get("boutique");
  if (boutique && !UUID.test(boutique)) return new Response("Boutique invalide", { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const releves = await listerReleves(client, mois, boutique);
    return new Response(csvReleves(releves), { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichierCsv(mois)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response("Impossible de préparer l’export. Réessayez.", { status: 500, headers: { "Cache-Control": "no-store" } }); }
}
