import Link from "next/link";
import { notFound } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { annulableParClient, formaterDateHeure, lireCommande } from "@/lib/commandes";
import { getLangue } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { textesDe, traduire } from "@/lib/textes";
import { formaterPrix } from "@/lib/prix";
import { afficherTaille } from "@/lib/article";
import { numeroWhatsApp } from "@/lib/whatsapp";
import FriseCommande from "@/components/FriseCommande";
import AnnulerCommande from "@/components/AnnulerCommande";
import BlocRetrait from "@/components/BlocRetrait";
import { lienPartageRetrait, lienRetrait, lireRetraitClient, qrCodeRetrait } from "@/lib/retrait";
import MerciParrainage from "@/components/MerciParrainage";
import { aEncaisser, raisonBonNonApplique } from "@/lib/bons";
import { lireMonParrainage, preparerInvitation } from "@/lib/parrainage";

export const metadata = { title: "Suivi de commande", robots: { index: false, follow: false } };

export default async function SuiviCommande({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ bon?: string }> }) {
  const { id } = await params;
  const raisonBon = raisonBonNonApplique((await searchParams)?.bon);
  const client = await creerClientServeur();
  const langue = await getLangue();
  const t = textesDe(langue).commandes;
  const { data: { user } } = await client.auth.getUser();
  let commande;
  try { commande = await lireCommande(client, id); }
  catch { return <main className="mx-auto w-full max-w-lg p-6"><p role="alert">{t.commandeImpossible}</p></main>; }
  // Seul le client voit cette page (la boutique a « Commandes reçues ») ; la base filtre déjà les autres comptes.
  if (!commande || !user || commande.client_id !== user.id) notFound();
  const boutique = commande.boutiques;
  // US-26.2 : QR code de retrait et code à 4 chiffres, seulement pour une commande prête (la base vérifie le compte et la date).
  let retrait: { qr: string; code: string; lien: string } | null = null;
  if (commande.statut === "prete") {
    try {
      const r = await lireRetraitClient(client, commande.id);
      if (r) retrait = { qr: await qrCodeRetrait(r.jeton), code: r.code, lien: lienRetrait(r.jeton) };
    } catch { retrait = null; } // sans QR code, la commande reste remise par la boutique (« Remis sans QR code »)
  }
  // US-27.3 : après un retrait, invitation à parrainer (seulement si le parrainage est ouvert et le client peut parrainer).
  let merci: { whatsapp: string | null } | null = null;
  if (commande.statut === "recuperee") {
    const mon = await lireMonParrainage(client).catch(() => null);
    if (mon?.actif && mon.peut_parrainer) merci = { whatsapp: (await preparerInvitation(client, langue).catch(() => null))?.whatsapp ?? null };
  }
  const tBon = textesDe(langue).parrainage;
  const remise = commande.remise_bon ?? 0;
  const motif = commande.motif_annulation && Object.hasOwn(t.motifs, commande.motif_annulation) ? traduire(t.motifs, commande.motif_annulation) : null;
  return <main className="mx-auto w-full max-w-lg bg-blanc pb-10 text-noir">
    <header className="border-b border-trait px-6 pb-5 pt-6 text-center"><p className="etiquette text-gris">{remplir(t.numero, { n: commande.numero })}{boutique ? ` · ${boutique.nom}` : ""}</p><h1 className="font-titre text-[28px] font-normal">{t.titresSuivi[commande.statut]}</h1></header>
    {commande.statut === "prete" && commande.expire_le && <p className="border-b border-trait px-6 py-3 text-center text-sm">{t.aRecuperer} <strong className="font-medium">{formaterDateHeure(commande.expire_le, langue)}</strong>{boutique?.adresse ? ` · ${boutique.adresse}` : ""}</p>}
    {commande.statut === "annulee" && motif && <p className="border-b border-trait px-6 py-3 text-center text-sm">{remplir(t.motif, { motif })}</p>}
    {commande.statut === "expiree" && <p className="border-b border-trait px-6 py-3 text-center text-sm">{t.expiree}</p>}
    {raisonBon && remise === 0 && commande.statut === "demandee" && <p role="status" className="mx-4 mt-4 border border-noir p-3 text-sm leading-[1.6]">{tBon.bonNonApplique[raisonBon]}</p>}
    {retrait && <div className="px-4 pt-[18px]"><BlocRetrait qr={retrait.qr} code={retrait.code} numero={commande.numero} total={commande.total} remise={remise}
      partage={{ lien: retrait.lien, whatsapp: lienPartageRetrait(langue, commande.numero, boutique?.nom ?? "BleDeal", retrait.lien) }} /></div>}
    <div className="px-6 pt-5">
      <FriseCommande statut={commande.statut} suivi={commande.suivi_commandes} />
      <ul aria-label={t.articles} className="mt-2 border-t border-trait pt-3 text-[13px] font-light">{commande.lignes_commande.map(l => <li key={l.id} className="flex justify-between gap-3 py-1"><span>{l.article_id ? <Link href={`/a/${l.article_id}`} className="underline-offset-2 hover:underline">{l.titre}</Link> : l.titre} · {afficherTaille(l.taille, langue)} × {l.quantite}</span><span className="whitespace-nowrap">{formaterPrix(l.prix_unitaire * l.quantite, langue)}</span></li>)}</ul>
      <p className="flex justify-between pt-2"><span className="etiquette self-center">{t.total}</span><span>{formaterPrix(commande.total, langue)}</span></p>
      {remise > 0 && <>
        <p className="flex justify-between pt-1 text-sm"><span>{tBon.ligneBon}</span><span dir="ltr">−{formaterPrix(remise, langue)}</span></p>
        <p className="flex justify-between border-t border-noir pt-2 font-medium"><span>{textesDe(langue).retrait.aPayer}</span><span>{formaterPrix(aEncaisser(commande.total, remise), langue)}</span></p>
      </>}
      {merci && <MerciParrainage whatsapp={merci.whatsapp} />}
      {commande.note && <p className="mt-2 text-sm text-gris">{remplir(t.note, { note: commande.note })}</p>}
      <div className="mt-6 flex flex-col gap-3">
        {boutique?.whatsapp && <a href={`https://wa.me/${numeroWhatsApp(boutique.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="etiquette flex min-h-11 items-center justify-center border border-noir">{t.ecrire}</a>}
        {boutique?.slug && <Link href={`/b/${boutique.slug}`} className="etiquette flex min-h-11 items-center justify-center text-gris underline">{t.voirBoutique}{boutique.quartier ? ` · ${boutique.quartier}` : ""}</Link>}
        {annulableParClient(commande.statut) && <AnnulerCommande id={commande.id} />}
      </div>
      <p className="mt-4 text-center text-xs text-gris">{t.mention}</p>
    </div>
  </main>;
}
