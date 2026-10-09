import Link from "next/link";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import NouvelArticle from "@/components/NouvelArticle";
import styles from "@/components/espace-articles.module.css";

export default async function AjouterArticle() {
  const supabase = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await supabase.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const { data: profil, error } = await supabase.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Impossible de charger votre profil. Réessayez dans quelques instants.");
  if (!profil?.boutique_id) return <main className={`${styles.espace} mx-auto max-w-[390px] p-6`}><h1 className="font-titre text-[28px] font-normal">Nouvel article</h1><p>Votre compte n&apos;est rattaché à aucune boutique</p><Link href="/espace">Retour à mon espace</Link></main>;
  return <NouvelArticle boutiqueId={profil.boutique_id} />;
}
