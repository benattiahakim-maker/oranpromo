import { ImageResponse } from "next/og";
import { creerClientServeur } from "@/lib/supabase/server";
import { slugValide } from "@/lib/lien-boutique";
import { villeLue } from "@/lib/ville";

// US-22 : image d'aperçu (1200 × 630) d'une boutique validée sans photo d'article.
// Générée localement (next/og, inclus dans Next.js), noir sur blanc comme les maquettes.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slugValide(slug)) return new Response("Boutique indisponible", { status: 404 });
  const supabase = await creerClientServeur();
  const { data: boutique } = await supabase.from("boutiques").select("nom, quartier, villes(nom)").eq("slug", slug).eq("statut", "validee").maybeSingle();
  if (!boutique) return new Response("Boutique indisponible", { status: 404 });
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", color: "#0A0A0A", border: "24px solid #0A0A0A", padding: "60px" }}>
      <div style={{ fontSize: 28, letterSpacing: 8, color: "#6F6F6F", textTransform: "uppercase" }}>{villeLue(boutique.villes)?.nom ? `${boutique.quartier} · ${villeLue(boutique.villes)?.nom}` : boutique.quartier}</div>
      <div style={{ fontSize: boutique.nom.length > 30 ? 64 : 88, marginTop: 28, textAlign: "center", lineHeight: 1.1 }}>{boutique.nom}</div>
      <div style={{ width: 120, height: 2, backgroundColor: "#0A0A0A", marginTop: 40 }} />
      <div style={{ fontSize: 40, marginTop: 40 }}>BleDeal</div>
      <div style={{ fontSize: 26, color: "#6F6F6F", marginTop: 12 }}>Réservez sur WhatsApp, payez en boutique</div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
