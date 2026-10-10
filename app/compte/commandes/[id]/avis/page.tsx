import Link from "next/link";
import { notFound } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireCommande } from "@/lib/commandes";
import { avisPossible, lireMesNotes } from "@/lib/avis";
import { getLangue } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import FormulaireAvis from "@/components/FormulaireAvis";

export const metadata = { title: "Donner mon avis", robots: { index: false, follow: false } };

/** US-32.2 : « Donner mon avis » sur une commande récupérée par QR code depuis 14 jours au plus. */
export default async function DonnerAvis({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await creerClientServeur();
  const textes = textesDe(await getLangue());
  const t = textes.avis;
  const { data: { user } } = await client.auth.getUser();
  let commande;
  try { commande = await lireCommande(client, id); }
  catch { return <main className="mx-auto w-full max-w-lg p-6"><p role="alert">{textes.commandes.commandeImpossible}</p></main>; }
  if (!commande || !user || commande.client_id !== user.id) notFound();
  const boutique = commande.boutiques?.nom ?? "BleDeal";
  const notes = await lireMesNotes(client, [commande.id]).catch(() => new Map<string, number>());
  const note = notes.get(commande.id);
  const retour = <Link href={`/compte/commandes/${commande.id}`} className="etiquette mt-6 flex min-h-11 items-center justify-center border border-noir">{t.retourCommande}</Link>;
  return <main className="mx-auto w-full max-w-lg bg-blanc px-6 pb-10 text-noir">
    <header className="border-b border-trait pb-5 pt-6 text-center">
      <p className="etiquette text-gris">{remplir(t.commande, { n: commande.numero })}</p>
      <h1 className="font-titre text-[26px] font-normal">{remplir(t.titre, { boutique })}</h1>
    </header>
    {note !== undefined ? <div className="py-6 text-center"><p>{remplir(t.donne, { note })}</p>{retour}</div>
      : !avisPossible(commande) ? <div className="py-6 text-center"><p role="alert">{t.plusPossible}</p>{retour}</div>
      : <FormulaireAvis commande={commande.id} />}
  </main>;
}
