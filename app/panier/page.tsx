import EntetePublic from "@/components/EntetePublic";
import PanierCommande, { type ParrainagePanier, type ProfilPanier } from "@/components/PanierCommande";
import { cookies } from "next/headers";
import { COOKIE_PARRAIN, lireMonParrainage, normaliserCodeParrainage } from "@/lib/parrainage";
import { bonDisponible, lireMesBons } from "@/lib/bons";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireProfilClient, profilComplet } from "@/lib/clients";
import { modeConnexionClient } from "@/lib/telephone";
import { getTextes } from "@/lib/langue-serveur";
import { lireDocumentsAAccepter, type DocumentAAccepter } from "@/lib/acceptations";

export const metadata = { title: "Mon panier", robots: { index: false, follow: false } };

export default async function Panier() {
  let profil: ProfilPanier = null;
  let parrainage: ParrainagePanier = { bonDisponible: false, choix: null };
  let conditions: DocumentAAccepter[] = [];
  try {
    const client = await creerClientServeur();
    const lu = await lireProfilClient(client);
    // US-21.2 : en mode téléphone, il faut un numéro vérifié par code pour commander (règle aussi dans la base).
    const verificationRequise = modeConnexionClient() === "telephone";
    if (lu) profil = { nom: lu.nom, telephone: lu.telephone, complet: profilComplet(lu, verificationRequise), bloque: lu.bloque, noShows: lu.no_shows,
      telephoneVerifie: Boolean(lu.telephone_verifie_le), verificationRequise };
    // US-27 : bon disponible (case du panier) et saisie du parrain avant la première commande.
    if (lu?.role === "client") {
      // US-34.2 : textes à (re)accepter avant la commande (la commande le vérifie aussi côté serveur).
      const [mon, bons, aAccepter] = await Promise.all([lireMonParrainage(client).catch(() => null), lireMesBons(client).catch(() => []), lireDocumentsAAccepter(client).catch(() => [])]);
      conditions = aAccepter;
      const code = normaliserCodeParrainage((await cookies()).get(COOKIE_PARRAIN)?.value) ?? "";
      parrainage = { bonDisponible: Boolean(bonDisponible(bons)), bons, choix: mon?.peut_choisir ? { initial: mon.parrain_saisi ? "" : code, parrainSaisi: mon.parrain_saisi, saisies: mon.saisies } : null };
    }
  } catch { /* Profil illisible : le bouton propose de se connecter, la base vérifiera à la commande. */ }
  return <><EntetePublic /><main className="mx-auto w-full max-w-lg bg-blanc pb-6 text-noir">
    <h1 className="pt-6 pb-2 text-center font-titre text-[28px] font-normal">{(await getTextes()).panier.titre}</h1>
    <PanierCommande profil={profil} parrainage={parrainage} conditions={conditions} />
  </main></>;
}
