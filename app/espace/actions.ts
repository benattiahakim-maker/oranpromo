"use server";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";

export async function deconnecter() {
  const client = await creerClientServeur();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/espace?erreur=deconnexion");
  redirect("/espace/connexion");
}
