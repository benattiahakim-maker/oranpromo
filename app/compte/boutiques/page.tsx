import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { listerMesBoutiques, type BoutiqueSuivie } from "@/lib/abonnements";
import { getLangue } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import MesBoutiques from "@/components/MesBoutiques";
import AlertesCompte from "@/components/AlertesCompte";
import { afficherBlocCompte, lireEtatAlertes } from "@/lib/alertes-whatsapp";

export const metadata = { title: "Mes boutiques", robots: { index: false, follow: false } };

// US-31.2 : boutiques suivies par le client (les boutiques suspendues ou fermées n'apparaissent pas).
export default async function PageMesBoutiques() {
  const client = await creerClientServeur();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/compte/connexion?suite=/compte/boutiques");
  const langue = await getLangue();
  const textes = textesDe(langue);
  const t = textes.suivre;
  let boutiques: BoutiqueSuivie[] = [], erreur = false;
  try { boutiques = await listerMesBoutiques(client); } catch { erreur = true; }
  // US-31.5 : bloc « Alertes WhatsApp » si elles sont proposées, ou actives (on peut toujours les arrêter).
  const alertes = await lireEtatAlertes(client);
  return <main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    <header className="border-b border-trait pb-5 pt-6 text-center"><p className="etiquette text-gris">{textes.compte.monCompte}</p><h1 className="font-titre text-[28px] font-normal">{erreur ? t.titre : remplir(t.mesBoutiques, { n: boutiques.length })}</h1></header>
    {erreur ? <p role="alert" className="py-6">{t.erreur}</p> : <MesBoutiques boutiques={boutiques} langue={langue} t={t} />}
    {afficherBlocCompte(alertes) && <AlertesCompte activesAuDepart={alertes.actives} proposees={alertes.proposees} />}
  </main>;
}
