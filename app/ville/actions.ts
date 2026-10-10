"use server";
// US-29.2 : choix de la ville (page /villes) : garde la ville dans le cookie « ville » (un an, comme la langue)
// et ouvre la même page dans cette ville. Marche sans JavaScript (formulaire). Seule une ville ouverte est acceptée.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getVillesOuvertes } from "@/lib/ville-serveur";
import { COOKIE_VILLE, DUREE_COOKIE_VILLE, cheminApresChoix } from "@/lib/ville";

export async function choisirVille(donnees: FormData): Promise<void> {
  const code = String(donnees.get("ville") ?? "");
  const retour = String(donnees.get("retour") ?? "");
  const ouvertes = await getVillesOuvertes();
  if (!ouvertes.some(v => v.code === code)) redirect("/villes");
  (await cookies()).set(COOKIE_VILLE, code, {
    path: "/",
    maxAge: DUREE_COOKIE_VILLE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect(cheminApresChoix(code, retour, ouvertes.map(v => v.code)));
}
