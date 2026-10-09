import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { formaterDateHeure, listerMesCommandes, STATUTS_COMMANDE, type ResumeCommande } from "@/lib/commandes";
import { lireProfilClient, messageNoShows } from "@/lib/clients";
import { formaterPrix } from "@/lib/prix";

export const metadata = { title: "Mes commandes", robots: { index: false, follow: false } };

export default async function MesCommandes() {
  const client = await creerClientServeur();
  let commandes: ResumeCommande[] = [], avertissement: string | null = null, erreur = false;
  try {
    commandes = await listerMesCommandes(client);
    const profil = await lireProfilClient(client);
    avertissement = profil ? messageNoShows(profil.no_shows, profil.bloque) : null;
  } catch { erreur = true; }
  return <main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    <header className="border-b border-trait pb-5 pt-6 text-center"><p className="etiquette text-gris">Mon compte</p><h1 className="font-titre text-[28px] font-normal">Mes commandes</h1></header>
    {avertissement && <p role="alert" className="border-b border-trait py-3 text-sm">{avertissement}</p>}
    {erreur ? <p role="alert" className="py-6">Impossible de charger vos commandes. Réessayez.</p>
      : !commandes.length ? <div className="py-8 text-center"><p>Vous n’avez pas encore de commande.</p><Link href="/catalogue" className="etiquette mt-6 flex min-h-[54px] items-center justify-center bg-noir text-blanc">Voir les articles</Link></div>
      : <ul>{commandes.map(c => <li key={c.id}><Link href={`/compte/commandes/${c.id}`} className="flex items-center justify-between gap-3 border-b border-trait py-4">
        <span className="flex min-w-0 flex-col gap-1"><span className="break-words text-sm font-light">Commande n° {c.numero}{c.boutiques ? ` · ${c.boutiques.nom}` : ""}</span><span className="text-xs text-gris">{formaterDateHeure(c.cree_le)} · {formaterPrix(c.total)}</span></span>
        <span className="etiquette whitespace-nowrap">{STATUTS_COMMANDE[c.statut]}</span>
      </Link></li>)}</ul>}
  </main>;
}
