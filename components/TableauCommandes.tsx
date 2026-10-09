"use client";
// US-28.1 : lignes serrées (téléphone) et tableau compact (ordinateur ≥ 1 024 px), dans une seule liste ; US-28.2 : cases à cocher, barre d’action, compte rendu.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changerStatutCommandeBoutique, changerStatutCommandesBoutique } from "@/app/espace/commandes/actions";
import { CarteCommande } from "@/components/CommandesRecues";
import { useEstNouvelle } from "@/components/MiseAJourCommandes";
import { ACTION_BOUTIQUE, estStockInsuffisant, quantiteTotale, type CommandeRecue } from "@/lib/commandes";
import { aEncaisser } from "@/lib/bons";
import { formaterPrix } from "@/lib/prix";
import { ACTION_GROUPEE, compteRendu, ETAPES, etapeDeStatut, GROUPE_MAX, heureCourte, heureEtape, prenom, urgence, type EtapeCommande } from "@/lib/tableau-commandes";

const COLONNES = "lg:grid-cols-[56px_minmax(0,1fr)_64px_104px_96px_180px_88px]";

export default function TableauCommandes({ commandes, etape, boutique, maintenant }: { commandes: CommandeRecue[]; etape: EtapeCommande | null; boutique: string; maintenant: number }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [alertes, setAlertes] = useState<Record<string, string>>({});
  // US-28.2 : cases à cocher sur « À confirmer » et « À préparer » seulement.
  const statutGroupe = etape ? ACTION_GROUPEE[etape] : undefined;
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [rapport, setRapport] = useState<ReturnType<typeof compteRendu> | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);
  const cochees = commandes.filter(c => selection.has(c.id));
  const trop = cochees.length > GROUPE_MAX;
  const vide = etape ? ETAPES[etape].vide : "Aucune commande ne correspond.";

  function cocher(id: string) { setSelection(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toutCocher() { setSelection(cochees.length === commandes.length ? new Set() : new Set(commandes.map(c => c.id))); }

  async function agirGroupe() {
    if (verrou.current || !statutGroupe || !cochees.length || trop) return;
    verrou.current = true; setEnvoi(true); setRapport(null);
    try {
      const resultat = await changerStatutCommandesBoutique(cochees.map(c => c.id), statutGroupe);
      setRapport(compteRendu(resultat, statutGroupe));
      // Les échouées restent cochées ; les réussies quittent l’étape au rafraîchissement.
      setSelection(new Set(resultat.succes ? resultat.echecs.map(e => e.id) : cochees.map(c => c.id)));
      if (resultat.reussies.length) router.refresh();
    } catch { setRapport({ titre: "Impossible de modifier les commandes. Vérifiez votre connexion.", lignes: [] }); }
    finally { verrou.current = false; setEnvoi(false); }
  }

  const libelleAction = statutGroupe === "confirmee" ? `Confirmer ${cochees.length > 1 ? `les ${cochees.length}` : "la commande"}` : `Marquer prête${cochees.length > 1 ? "s" : ""} (${cochees.length})`;
  return <div className="flex flex-col">
    {rapport && <div role="status" className="mx-4 my-2 border border-noir px-3 py-2.5 text-sm lg:mx-0">
      <p className="font-medium">{rapport.titre}</p>
      {rapport.lignes.map(l => <p key={l.id} className="mt-1.5 text-erreur">{l.texte} {commandes.some(c => c.id === l.id) && <button type="button" onClick={() => setOuverte(l.id)} className="text-noir underline">Voir</button>}</p>)}
    </div>}
    {!commandes.length ? <p className="py-8 text-center text-sm text-gris">{vide}</p> : <>
      {statutGroupe && <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-trait px-3 text-xs text-gris">
        <input type="checkbox" checked={cochees.length === commandes.length} onChange={toutCocher} className="size-5" />Tout cocher ({commandes.length})
        <span className="ml-auto">Les plus urgentes en haut</span>
      </label>}
      {/* En-têtes du tableau, sur ordinateur seulement. */}
      <div aria-hidden="true" className="etiquette hidden min-h-10 items-center border-b border-noir text-[10px] text-gris lg:flex">
        {statutGroupe && <span className="w-11 shrink-0" />}
        <span className={`grid flex-1 ${COLONNES} gap-x-3 ${statutGroupe ? "" : "pl-3"}`}><span>N°</span><span>Prénom</span><span>Articles</span><span className="text-right">À encaisser</span><span>{etape ? ETAPES[etape].heure : "Étape"}</span><span>Échéance</span><span>Bon</span></span>
        <span className="w-[158px]" />
      </div>
      <ul>{commandes.map(c => <Ligne key={c.id} commande={c} etape={etape} boutique={boutique} maintenant={maintenant} ouverte={ouverte === c.id} alerte={alertes[c.id]}
        cochable={Boolean(statutGroupe)} cochee={selection.has(c.id)} cocher={() => cocher(c.id)}
        basculer={() => setOuverte(o => o === c.id ? null : c.id)}
        signaler={message => { setAlertes(a => ({ ...a, [c.id]: message })); setOuverte(c.id); }} />)}</ul>
    </>}
    {statutGroupe && cochees.length > 0 && <div className="sticky bottom-0 z-10 mt-3 flex items-center gap-3 bg-noir px-3 py-2.5 text-blanc lg:sticky lg:top-0 lg:bottom-auto lg:order-first lg:mb-2 lg:mt-0 lg:pl-4">
      <p className="flex-1 text-[13px] lg:flex lg:flex-none lg:gap-4 lg:text-sm">{cochees.length} commande{cochees.length > 1 ? "s" : ""} cochée{cochees.length > 1 ? "s" : ""}<br className="lg:hidden" /><button type="button" onClick={() => setSelection(new Set())} className="text-xs text-[#CFCFCF] underline lg:text-[13px]">Décocher</button></p>
      <button type="button" disabled={envoi || trop} onClick={() => void agirGroupe()} className="etiquette min-h-11 bg-blanc px-3.5 text-noir lg:ml-auto">{trop ? `${GROUPE_MAX} au plus à la fois` : libelleAction}</button>
    </div>}
  </div>;
}

function Ligne({ commande, etape, boutique, maintenant, ouverte, alerte, cochable, cochee, cocher, basculer, signaler }: { commande: CommandeRecue; etape: EtapeCommande | null; boutique: string; maintenant: number; ouverte: boolean; alerte?: string; cochable: boolean; cochee: boolean; cocher: () => void; basculer: () => void; signaler: (message: string) => void }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const estNouvelle = useEstNouvelle();
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

  return <li className={`border-b border-trait ${cochee ? "bg-[#F5F5F5]" : ""}`}>
    <div className="flex items-stretch">
      {cochable && <label className="flex w-11 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" checked={cochee} onChange={cocher} aria-label={`Cocher la commande n° ${commande.numero}`} className="size-5" /></label>}
      <button type="button" aria-expanded={ouverte} aria-controls={idDetail} onClick={basculer} className={`grid min-h-16 flex-1 grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 py-2 ${cochable ? "pl-0" : "pl-3"} text-left lg:min-h-11 lg:py-1.5 ${COLONNES} lg:items-center`}>
        <span className="col-start-1 row-start-1 min-w-0 truncate text-[15px] lg:contents">
          <span className="font-medium lg:col-start-1 lg:row-start-1"><span className="lg:hidden">N° </span>{commande.numero}</span>
          <span className="lg:col-start-2 lg:row-start-1 lg:flex lg:min-w-0 lg:items-center"><span className="lg:hidden"> · </span><span className="lg:min-w-10 lg:truncate">{prenom(commande.client_nom)}</span>{estNouvelle(commande) && <span className="ml-1.5 shrink-0 bg-noir px-1 py-px align-middle text-[9px] uppercase tracking-[1.2px] text-blanc lg:tracking-[0.4px]">Nouveau</span>}</span>
        </span>
        <span className="col-start-1 row-start-2 text-xs text-gris lg:contents lg:text-sm lg:text-noir">
          <span className="lg:col-start-3 lg:row-start-1">{pieces}<span className="lg:hidden"> article{pieces > 1 ? "s" : ""}</span></span>
          <span className="lg:hidden"> · </span>
          <span className="lg:col-start-5 lg:row-start-1">{etape ? <><span className="lg:hidden">{ETAPES[etape].heure.toLowerCase()} {/^\d/.test(heure) ? "à " : ""}</span>{heure}</> : ETAPES[etapeLigne].libelle}</span>
        </span>
        <span className={`col-start-1 row-start-3 text-xs lg:col-start-6 lg:row-start-1 lg:text-sm ${u.rouge ? "font-medium text-erreur" : "text-gris"}`}>{u.rouge && <span aria-hidden="true">● </span>}{u.texte}</span>
        <span className="col-start-2 row-start-1 whitespace-nowrap text-right text-[15px] lg:col-start-4 lg:row-start-1 lg:text-sm">{formaterPrix(aEncaisser(commande.total, remise))}</span>
        {remise > 0 && <span className="col-start-2 row-start-2 justify-self-end lg:col-start-7 lg:row-start-1 lg:justify-self-start"><span className="etiquette whitespace-nowrap border border-noir px-1 text-[9px]">Bon −{remise}</span></span>}
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
