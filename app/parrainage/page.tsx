import type { Metadata } from "next";
import { cookies } from "next/headers";
import EntetePublic from "@/components/EntetePublic";
import ContenuParrainage, { type VueParrainage } from "@/components/ContenuParrainage";
import { creerClientServeur } from "@/lib/supabase/server";
import { getLangue } from "@/lib/langue-serveur";
import { textesDe } from "@/lib/textes";
import { COOKIE_PARRAIN, lireMonParrainage, preparerInvitation, normaliserCodeParrainage, parrainageOuvert, type MonParrainage } from "@/lib/parrainage";

export const metadata: Metadata = { title: "Parrainage", description: "Parraine tes amis sur OranPromo : un bon de 300 DA chacun, à déduire en boutique." };
export const dynamic = "force-dynamic";

// US-27.3 : page publique du parrainage. Connecté avec un numéro vérifié : code, lien, WhatsApp, QR code.
// ?invite=1 (après /p/<code>) : « Un ami t'invite » et champ du parrain pré-rempli avec le code gardé en cookie.
export default async function PageParrainage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const langue = await getLangue();
  const t = textesDe(langue).parrainage;
  const client = await creerClientServeur();
  const [{ data: { user } }, ouvert] = await Promise.all([client.auth.getUser(), parrainageOuvert(client)]);
  let mon: MonParrainage | null = null;
  if (user) {
    try { mon = await lireMonParrainage(client); } catch { mon = null; }
  }
  const codeInvite = normaliserCodeParrainage((await cookies()).get(COOKIE_PARRAIN)?.value) ?? "";
  const vue: VueParrainage = {
    ouvert, invite: invite === "1",
    visiteur: !user ? "anonyme" : mon?.peut_parrainer ? "client" : "autre",
    invitation: mon?.actif && mon.peut_parrainer ? await preparerInvitation(client, langue, { qr: true }) : null,
    choix: mon?.peut_choisir ? { initial: mon.parrain_saisi ? "" : codeInvite, parrainSaisi: mon.parrain_saisi, saisies: mon.saisies } : null,
  };
  return <><EntetePublic /><ContenuParrainage t={t} vue={vue} /></>;
}
