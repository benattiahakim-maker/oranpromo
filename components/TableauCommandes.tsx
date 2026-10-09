"use client";
// US-28.1 : lignes serrées (téléphone) et tableau compact (ordinateur ≥ 1 024 px), dans une seule liste.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changerStatutCommandeBoutique } from "@/app/espace/commandes/actions";
import { CarteCommande } from "@/components/CommandesRecues";
import { ACTION_BOUTIQUE, estStockInsuffisant, quantiteTotale, type CommandeRecue } from "@/lib/commandes";
import { aEncaisser } from "@/lib/bons";
import { formaterPrix } from "@/lib/prix";
import { ETAPES, etapeDeStatut, heureCourte, heureEtape, prenom, urgence, type EtapeCommande } from "@/lib/tableau-commandes";

const COLONNES = "lg:grid-cols-[56px_minmax(0,1fr)_72px_104px_96px_190px_88px]";

export default function TableauCommandes({ commandes, etape, boutique, maintenant }: { commandes: CommandeRecue[]; etape: EtapeCommande | null; boutique: string; maintenant: number }) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [alertes, setAlertes] = useState<Record<string, string>>({});
  const vide = etape ? ETAPES[etape].vide : "Aucune commande ne correspond.";
  if (!commandes.length) return <p className="py-8 text-center text-sm text-gris">{vide}</p>;
  return <div>
    {/* En-têtes du tableau, sur ordinateur seulement. */}
    <div aria-hidden="true" className="etiquette hidden min-h-10 items-center border-b border-noir text-[10px] text-gris lg:flex">
      <span className={`grid flex-1 ${COLONNES} gap-x-3 pl-3`}><span>N°</span><span>Prénom</span><span>Articles</span><span className="text-right">À encaisser</span><span>{etape ? ETAPES[etape].heure : "Étape"}</span><span>Échéance</span><span>Bon</span></span>
      <span className="w-[158px]" />
    </div>
    <ul>{commandes.map(c => <Ligne key={c.id} commande={c} etape={etape} boutique={boutique} maintenant={maintenant} ouverte={ouverte === c.id} alerte={alertes[c.id]}
      basculer={() => setOuverte(o => o === c.id ? null : c.id)}
      signaler={message => { setAlertes(a => ({ ...a, [c.id]: message })); setOuverte(c.id); }} />)}</ul>
  </div>;
}

function Ligne({ commande, etape, boutique, maintenant, ouverte, alerte, basculer, signaler }: { commande: CommandeRecue; etape: EtapeCommande | null; boutique: string; maintenant: number; ouverte: boolean; alerte?: string; basculer: () => void; signaler: (message: string) => void }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const u = urgence(commande, maintenant);
  const pieces = quantiteTotale(commande.lignes_commande);
  const remise = commande.remise_bon ?? 0;
  const heure = heureCourte(heureEtape(commande), maintenant);
  const etapeLigne = etapeDeStatut(commande.statut);
  const action = ACTION_BOUTIQUE[commande.statut];
  const idDetail = `detail-${commande.id}`;

  // Bouton de l’étape dans la ligne (ordinateur) : même action serveur que le détail.
  async function agir() {
    if (verrou.current || !action) return;
    verrou.current = true; setEnCours(true);
    try {
      const resultat = await changerStatutCommandeBoutique(commande.id, action.statut, null, "");
      if (resultat.succes) router.refresh(); else signaler(resultat.message);
    } catch { signaler("Impossible de modifier la commande. Vérifiez votre connexion."); }
    finally { verrou.current = false; setEnCours(false); }
  }

  return <li className="border-b border-trait">
    <div className="flex items-stretch">
      <button type="button" aria-expanded={ouverte} aria-controls={idDetail} onClick={basculer} className={`grid min-h-16 flex-1 grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 py-2 pl-3 text-left lg:min-h-11 lg:py-1.5 ${COLONNES} lg:items-center`}>
        <span className="col-start-1 row-start-1 min-w-0 truncate text-[15px] lg:contents">
          <span className="font-medium lg:col-start-1 lg:row-start-1"><span className="lg:hidden">N° </span>{commande.numero}</span>
          <span className="lg:col-start-2 lg:row-start-1 lg:truncate"><span className="lg:hidden"> · </span>{prenom(commande.client_nom)}</span>
        </span>
        <span className="col-start-1 row-start-2 text-xs text-gris lg:contents lg:text-sm lg:text-noir">
          <span className="lg:col-start-3 lg:row-start-1">{pieces}<span className="lg:hidden"> article{pieces > 1 ? "s" : ""}</span></span>
          <span className="lg:hidden"> · </span>
          <span className="lg:col-start-5 lg:row-start-1">{etape ? <><span className="lg:hidden">{ETAPES[etape].heure.toLowerCase()} {/^\d/.test(heure) ? "à " : ""}</span>{heure}</> : ETAPES[etapeLigne].libelle}</span>
        </span>
        <span className={`col-start-1 row-start-3 text-xs lg:col-start-6 lg:row-start-1 lg:text-sm ${u.rouge ? "font-medium text-erreur" : "text-gris"}`}>{u.rouge && <span aria-hidden="true">● </span>}{u.texte}</span>
        <span className="col-start-2 row-start-1 whitespace-nowrap text-right text-[15px] lg:col-start-4 lg:row-start-1 lg:text-sm">{formaterPrix(aEncaisser(commande.total, remise))}</span>
        {remise > 0 && <span className="col-start-2 row-start-2 justify-self-end lg:col-start-7 lg:row-start-1 lg:justify-self-start"><span className="etiquette border border-noir px-1 text-[9px]">Bon −{remise}</span></span>}
      </button>
      <span className="hidden w-[130px] items-center justify-end pr-1 lg:flex">
        {action && commande.statut !== "prete" && <button type="button" disabled={enCours} onClick={() => void agir()} className="etiquette min-h-9 border border-noir px-3 text-[10px]">{action.libelle}</button>}
        {commande.statut === "prete" && <Link href="/espace/scanner" className="etiquette inline-flex min-h-9 items-center border border-noir px-3 text-[10px]">Scanner</Link>}
      </span>
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={basculer} className="w-7 shrink-0 text-gris">{ouverte ? "⌃" : "⌄"}</button>
    </div>
    {ouverte && <div id={idDetail} className="bg-[#FAFAFA] px-4 pb-4 pt-2 lg:pl-[68px]">
      {alerte && <p role="alert" className="mb-2 text-sm text-erreur">{alerte}{estStockInsuffisant(alerte) && <> <Link href="/espace" className="underline">Corriger le stock dans Mes articles</Link></>}</p>}
      <CarteCommande commande={commande} boutique={boutique} dansTableau />
    </div>}
  </li>;
}
