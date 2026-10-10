import Link from "next/link";
import Prix from "@/components/Prix";
import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireCommandeAConfirmer, lireLienConfirmation, MESSAGES_CONFIRMATION, secretConfirmation, type CommandeAConfirmer } from "@/lib/confirmation";
import { formaterDateHeure, STATUTS_COMMANDE } from "@/lib/commandes";
import ConfirmerCommande from "@/components/ConfirmerCommande";

// US-20.6 : page ouverte par le bouton « Confirmer » du message WhatsApp. Sans connexion ; ne modifie rien à l'ouverture
// (les aperçus de liens et antivirus ouvrent parfois les liens tout seuls) : seule la touche confirme.
export const metadata: Metadata = { title: "Confirmer une commande", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const ETAT_STATUT: Partial<Record<CommandeAConfirmer["statut"], string>> = {
  confirmee: MESSAGES_CONFIRMATION.deja_confirmee, prete: MESSAGES_CONFIRMATION.deja_confirmee, recuperee: MESSAGES_CONFIRMATION.deja_confirmee,
  annulee: MESSAGES_CONFIRMATION.annulee, expiree: MESSAGES_CONFIRMATION.expiree,
};

function Cadre({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-[390px] bg-blanc text-noir">
    <header className="flex flex-col items-center gap-1.5 border-b border-trait px-6 pb-5 pt-7 text-center">
      <span className="font-titre text-xl">BleDeal</span>
      {sousTitre && <p className="etiquette text-gris">{sousTitre}</p>}
      <h1 className="font-titre text-[28px] font-normal">{titre}</h1>
    </header>
    <div className="flex flex-col gap-3.5 px-6 py-4">{children}</div>
  </main>;
}

function Avis({ message, espace = false }: { message: string; espace?: boolean }) {
  return <><p role="status" className="border border-trait p-3 text-sm">{message}</p>
    {espace && <Link href="/espace/commandes" className="text-center text-xs underline">Ouvrir mon espace, rubrique Commandes</Link>}</>;
}

export default async function PageConfirmer({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const secret = secretConfirmation();
  if (!secret) return <Cadre titre="Confirmer une commande"><Avis message={MESSAGES_CONFIRMATION.indisponible} espace /></Cadre>;
  const lien = lireLienConfirmation(jeton, secret);
  if (lien.etat === "expire") return <Cadre titre="Lien expiré"><Avis message={MESSAGES_CONFIRMATION.lien_expire} espace /></Cadre>;
  if (lien.etat === "invalide") return <Cadre titre="Lien non valide"><Avis message={MESSAGES_CONFIRMATION.invalide} espace /></Cadre>;
  let commande: CommandeAConfirmer | null;
  try { commande = await lireCommandeAConfirmer(await creerClientServeur(), lien.commandeId, secret); }
  catch { return <Cadre titre="Confirmer une commande"><Avis message={MESSAGES_CONFIRMATION.indisponible} espace /></Cadre>; }
  if (!commande) return <Cadre titre="Lien non valide"><Avis message={MESSAGES_CONFIRMATION.invalide} espace /></Cadre>;

  const etat = ETAT_STATUT[commande.statut];
  return <Cadre titre="Nouvelle commande" sousTitre={`${commande.boutique} · Commande n° ${commande.numero}`}>
    <div className="flex justify-between text-sm"><span>{commande.client}</span><span className="etiquette text-[9px]">{STATUTS_COMMANDE[commande.statut]} · {formaterDateHeure(commande.cree_le)}</span></div>
    <ul className="flex flex-col gap-1.5 text-[13px] font-light">
      {commande.lignes.map((l, i) => <li key={i} className="flex justify-between gap-3"><span>{l.titre} · {l.taille} × {l.quantite}</span><span className="whitespace-nowrap"><Prix montant={l.prix_unitaire * l.quantite} /></span></li>)}
    </ul>
    <div className="flex justify-between border-t border-trait pt-2.5 text-sm"><span>Total</span><span><Prix montant={commande.total} /></span></div>
    {commande.note && <p className="text-xs font-light">Note du client : « {commande.note} »</p>}
    {etat ? <Avis message={etat} espace /> : <ConfirmerCommande jeton={jeton} />}
  </Cadre>;
}
