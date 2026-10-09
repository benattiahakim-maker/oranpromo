import EntetePublic from "@/components/EntetePublic";
import PanierCommande, { type ProfilPanier } from "@/components/PanierCommande";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireProfilClient, profilComplet } from "@/lib/clients";
import { modeConnexionClient } from "@/lib/telephone";
import { getTextes } from "@/lib/langue-serveur";

export const metadata = { title: "Mon panier", robots: { index: false, follow: false } };

export default async function Panier() {
  let profil: ProfilPanier = null;
  try {
    const lu = await lireProfilClient(await creerClientServeur());
    // US-21.2 : en mode téléphone, il faut un numéro vérifié par code pour commander (règle aussi dans la base).
    const verificationRequise = modeConnexionClient() === "telephone";
    if (lu) profil = { nom: lu.nom, telephone: lu.telephone, complet: profilComplet(lu, verificationRequise), bloque: lu.bloque, noShows: lu.no_shows,
      telephoneVerifie: Boolean(lu.telephone_verifie_le), verificationRequise };
  } catch { /* Profil illisible : le bouton propose de se connecter, la base vérifiera à la commande. */ }
  return <><EntetePublic /><main className="mx-auto w-full max-w-lg bg-blanc pb-6 text-noir">
    <h1 className="pt-6 pb-2 text-center font-titre text-[28px] font-normal">{(await getTextes()).panier.titre}</h1>
    <PanierCommande profil={profil} />
  </main></>;
}
