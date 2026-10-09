"use server";
// US-23 : choix de la langue par le sélecteur de l'en-tête (marche aussi sans JavaScript).
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { COOKIE_LANGUE, DUREE_COOKIE_LANGUE, langueDepuisCookie } from "@/lib/langue";

export async function choisirLangue(donnees: FormData): Promise<void> {
  const langue = langueDepuisCookie(String(donnees.get("langue") ?? ""));
  (await cookies()).set(COOKIE_LANGUE, langue, {
    path: "/",
    maxAge: DUREE_COOKIE_LANGUE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  refresh();
}
