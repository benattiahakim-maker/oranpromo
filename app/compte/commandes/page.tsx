import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { formaterDateHeure, listerMesCommandes, type ResumeCommande } from "@/lib/commandes";
import { getLangue } from "@/lib/langue-serveur";
import { traduireMessage } from "@/lib/textes/messages";
import { remplir } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import { lireProfilClient, messageNoShows } from "@/lib/clients";
import { formaterPrix } from "@/lib/prix";
import { avisPossible, lireMesNotes } from "@/lib/avis";

export const metadata = { title: "Mes commandes", robots: { index: false, follow: false } };

export default async function MesCommandes() {
  const client = await creerClientServeur();
  const langue = await getLangue();
  const textes = textesDe(langue);
  const t = textes.commandes;
  let commandes: ResumeCommande[] = [], avertissement: string | null = null, erreur = false;
  let notes = new Map<string, number>();
  try {
    commandes = await listerMesCommandes(client);
    // US-32.2 : notes déjà données (récupérées par QR code seulement) ; sans elles, la liste s'affiche sans les avis.
    notes = await lireMesNotes(client, commandes.filter(c => c.mode_remise === "qr").map(c => c.id)).catch(() => notes);
    const profil = await lireProfilClient(client);
    avertissement = profil ? traduireMessage(messageNoShows(profil.no_shows, profil.bloque), langue) : null;
  } catch { erreur = true; }
  return <main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    <header className="border-b border-trait pb-5 pt-6 text-center"><p className="etiquette text-gris">{textes.compte.monCompte}</p><h1 className="font-titre text-[28px] font-normal">{t.titre}</h1></header>
    {avertissement && <p role="alert" className="border-b border-trait py-3 text-sm">{avertissement}</p>}
    {erreur ? <p role="alert" className="py-6">{t.chargementImpossible}</p>
      : !commandes.length ? <div className="py-8 text-center"><p>{t.aucune}</p><Link href="/catalogue" className="etiquette mt-6 flex min-h-[54px] items-center justify-center bg-noir text-blanc">{t.voirArticles}</Link></div>
      : <ul>{commandes.map(c => { const note = notes.get(c.id); return <li key={c.id} className="border-b border-trait"><Link href={`/compte/commandes/${c.id}`} className="flex items-center justify-between gap-3 py-4">
        <span className="flex min-w-0 flex-col gap-1"><span className="break-words text-sm font-light">{remplir(t.numero, { n: c.numero })}{c.boutiques ? ` · ${c.boutiques.nom}` : ""}</span><span className="text-xs text-gris">{formaterDateHeure(c.cree_le, langue)} · {formaterPrix(c.total, langue)}</span></span>
        <span className="etiquette whitespace-nowrap">{t.statuts[c.statut]}</span>
      </Link>
      {note !== undefined ? <p className="pb-4 text-xs text-gris">{remplir(textes.avis.donne, { note })}</p>
        : avisPossible(c) && <Link href={`/compte/commandes/${c.id}/avis`} className="etiquette mb-4 flex min-h-11 items-center justify-center border border-noir">{textes.avis.donner}</Link>}
      </li>; })}</ul>}
  </main>;
}
