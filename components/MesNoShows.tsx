"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { contesterMonNoShow } from "@/app/compte/actions";
import { aUneContestationEnAttente, DELAI_CONTESTATION_JOURS, delaiContestationDepasse, erreurMotifContestation, etatContestation, MOTIF_CONTESTATION_MAX, type MonNoShow } from "@/lib/clients";
import { formaterDateHeure } from "@/lib/commandes";

// Contestation d’un no-show : le client voit ses commandes déclarées « non récupérées » et peut en contester
// chacune une fois, avec un motif court. OranPromo (l’admin) confirme ou annule.
// Règles du propriétaire : 7 jours pour contester, une seule contestation en attente à la fois.
export default function MesNoShows({ noShows, maintenant: maintenantFixe }: { noShows: MonNoShow[]; maintenant?: number }) {
  const [maintenantInitial] = useState(() => Date.now());
  const maintenant = maintenantFixe ?? maintenantInitial;
  const enAttente = aUneContestationEnAttente(noShows);
  return <section aria-labelledby="mes-no-shows" className="mt-6">
    <h2 id="mes-no-shows" className="etiquette">Commandes non récupérées ({noShows.length})</h2>
    <p className="mt-2 text-xs leading-[1.6] text-gris">La boutique a signalé que vous n’êtes pas venu(e). Si c’est une erreur, contestez dans les {DELAI_CONTESTATION_JOURS} jours : la commande ne compte plus tant qu’OranPromo n’a pas décidé. Une seule contestation à la fois.</p>
    <ul>{noShows.map(n => <li key={n.id}><LigneNoShow noShow={n} delaiDepasse={delaiContestationDepasse(n, maintenant)} autreEnAttente={enAttente} /></li>)}</ul>
  </section>;
}

function LigneNoShow({ noShow, delaiDepasse, autreEnAttente }: { noShow: MonNoShow; delaiDepasse: boolean; autreEnAttente: boolean }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const etat = etatContestation(noShow);
  const peutContester = etat === "a_contester" && !delaiDepasse && !autreEnAttente;
  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verrou.current) return;
    const erreur = erreurMotifContestation(motif);
    if (erreur) { setMessage(erreur); return; }
    verrou.current = true; setEnCours(true); setMessage("");
    try { const resultat = await contesterMonNoShow(noShow.id, motif); setMessage(resultat.message); if (resultat.succes) { setOuvert(false); router.refresh(); } }
    finally { verrou.current = false; setEnCours(false); }
  }
  const idMotif = `motif-${noShow.id}`;
  return <div className="border-b border-trait py-3.5">
    <p className="text-sm font-light">Commande n° {noShow.numero}{noShow.boutiques ? ` · ${noShow.boutiques.nom}` : ""}{noShow.no_show_le ? ` · ${formaterDateHeure(noShow.no_show_le)}` : ""}</p>
    {etat === "en_attente" && <p className="etiquette mt-1">Contestation en cours d’examen</p>}
    {etat === "refusee" && <p className="etiquette mt-1">Contestation refusée : la commande compte</p>}
    {etat !== "a_contester" && noShow.contestations?.motif && <p className="mt-1 break-words text-xs text-gris">Votre motif : {noShow.contestations.motif}</p>}
    {etat === "a_contester" && delaiDepasse && <p className="mt-1 text-xs text-gris">Délai de contestation dépassé ({DELAI_CONTESTATION_JOURS} jours).</p>}
    {etat === "a_contester" && !delaiDepasse && autreEnAttente && <p className="mt-1 text-xs text-gris">Vous pourrez contester celle-ci quand OranPromo aura répondu à votre contestation en cours.</p>}
    {peutContester && !ouvert && <button type="button" onClick={() => { setOuvert(true); setMessage(""); }} className="etiquette mt-2 min-h-11 border border-noir px-3">Contester</button>}
    {peutContester && ouvert && <form noValidate onSubmit={envoyer} className="mt-2 flex flex-col gap-2">
      <label htmlFor={idMotif} className="etiquette text-xs">Pourquoi contestez-vous ?</label>
      <textarea id={idMotif} value={motif} maxLength={MOTIF_CONTESTATION_MAX} rows={3} disabled={enCours} onChange={e => setMotif(e.target.value)} className="box-border w-full rounded-none border border-trait bg-blanc p-3 font-[inherit] text-base text-noir" />
      <p className="m-0 text-xs text-gris">{motif.length} / {MOTIF_CONTESTATION_MAX}</p>
      <div className="flex gap-2">
        <button type="submit" disabled={enCours} className="etiquette min-h-11 flex-1 bg-noir px-3 text-blanc">{enCours ? "Envoi…" : "Envoyer la contestation"}</button>
        <button type="button" disabled={enCours} onClick={() => setOuvert(false)} className="etiquette min-h-11 border border-trait px-3">Fermer</button>
      </div>
    </form>}
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </div>;
}
