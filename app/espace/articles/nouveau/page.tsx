import Link from "next/link";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import NouvelArticle from "@/components/NouvelArticle";

export default async function AjouterArticle() {
  const supabase = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await supabase.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const { data: profil, error } = await supabase.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Impossible de charger votre profil. Réessayez dans quelques instants.");
  if (!profil?.boutique_id) return <main style={{ maxWidth: 390, margin: "0 auto", padding: 24 }}><h1 style={{ fontFamily: "var(--font-bodoni), serif", fontSize: 28, fontWeight: 400 }}>Nouvel article</h1><p>Votre compte n&apos;est rattaché à aucune boutique</p><Link href="/espace">Retour à mon espace</Link></main>;
  return <NouvelArticle boutiqueId={profil.boutique_id} />;
}
