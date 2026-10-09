import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { roleAdministration } from "@/lib/boutique";
import type { ReactNode } from "react";
import styles from "@/components/espace-articles.module.css";

export default async function Administration({ children }: { children: ReactNode }) {
  const client = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const { data: profil, error } = await client.from("profils").select("role").eq("id", user.id).maybeSingle();
  if (error) return <main className={`${styles.espace} p-6`}><p role="alert">Impossible de vérifier votre accès. Réessayez.</p></main>;
  if (!roleAdministration(profil?.role)) return <main className={`${styles.espace} p-6`}><h1 className="font-titre text-[28px]">Accès réservé</h1></main>;
  return <div className={styles.espace}>{children}</div>;
}
