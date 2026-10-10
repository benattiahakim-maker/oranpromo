import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import ModifierArticle from "@/components/ModifierArticle";
import { getTextes } from "@/lib/langue-serveur";

export default async function ModificationArticle({ params }: { params: Promise<{ id: string }> }) {
  const client = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const e = (await getTextes()).espace;
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  if (erreurProfil) return <p role="alert" className="p-6">{e.commun.profilImpossible}</p>;
  if (!profil?.boutique_id) return <main className="mx-auto max-w-[390px] p-6"><p>{e.commun.sansBoutique}</p><Link href="/espace">{e.commun.retourArticles}</Link></main>;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: article, error } = await client.from("articles").select("*, photos(*), tailles(*), promos(*)").eq("id", id).eq("boutique_id", profil.boutique_id).maybeSingle();
  if (error) return <p role="alert" className="p-6">{e.modifier.articleImpossible}</p>;
  if (!article) notFound();
  return <ModifierArticle article={article} />;
}
