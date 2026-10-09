import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import ModifierArticle from "@/components/ModifierArticle";

export default async function ModificationArticle({ params }: { params: Promise<{ id: string }> }) {
  const client = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  if (erreurProfil) return <p role="alert" className="p-6">Impossible de charger votre profil. Réessayez.</p>;
  if (!profil?.boutique_id) return <main className="mx-auto max-w-[390px] p-6"><p>Votre compte n&apos;est rattaché à aucune boutique</p><Link href="/espace">Retour à mes articles</Link></main>;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: article, error } = await client.from("articles").select("*, photos(*), tailles(*), promos(*)").eq("id", id).eq("boutique_id", profil.boutique_id).maybeSingle();
  if (error) return <p role="alert" className="p-6">Impossible de charger cet article. Réessayez.</p>;
  if (!article) notFound();
  return <ModifierArticle article={article} />;
}
