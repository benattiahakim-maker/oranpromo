import Link from "next/link";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import NouvelArticle from "@/components/NouvelArticle";
import { getTextes } from "@/lib/langue-serveur";

export default async function AjouterArticle() {
  const supabase = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await supabase.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const e = (await getTextes()).espace;
  const { data: profil, error } = await supabase.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  if (error) throw new Error(e.nouvel.profilImpossible);
  if (!profil?.boutique_id) return <main className="mx-auto w-full max-w-[390px] p-6"><h1 className="font-titre text-[28px] font-normal">{e.nouvel.titre}</h1><p>{e.commun.sansBoutique}</p><Link href="/espace">{e.commun.retourEspace}</Link></main>;
  return <NouvelArticle boutiqueId={profil.boutique_id} />;
}
