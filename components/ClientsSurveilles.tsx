"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { annulerNoShowClient, debloquerCompteClient } from "@/app/admin/clients/actions";
import { essaisRestants, noShowsDuClient, telephoneLisible, type ClientSurveille, type NoShowDeclare } from "@/lib/clients";
import { formaterDateHeure } from "@/lib/commandes";

// US-20.4 : clients bloqués (bouton Débloquer) et clients avec des no-shows.
export default function ClientsSurveilles({ bloques, avecNoShows, noShows = [] }: { bloques: ClientSurveille[]; avecNoShows: ClientSurveille[]; noShows?: NoShowDeclare[] }) {
  return <>
    <h2 className="etiquette mt-6">Bloqués ({bloques.length})</h2>
    {bloques.length ? <ul>{bloques.map(c => <li key={c.id}><LigneClient client={c} noShows={noShowsDuClient(c, noShows)} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun client bloqué.</p>}
    <h2 className="etiquette mt-6">Avec des no-shows ({avecNoShows.length})</h2>
    {avecNoShows.length ? <ul>{avecNoShows.map(c => <li key={c.id}><LigneClient client={c} noShows={noShowsDuClient(c, noShows)} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun no-show.</p>}
    <p className="mt-4 text-xs leading-[1.6] text-gris">Un no-show est compté quand la boutique signale « Client pas venu » sur une commande prête non récupérée sous 24 h. Les no-shows suivent le compte et le numéro de téléphone. Au 5e, le compte est bloqué. Annuler un no-show baisse le compteur ; Débloquer le remet à 0.</p>
  </>;
}

function LigneClient({ client, noShows }: { client: ClientSurveille; noShows: NoShowDeclare[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function debloquer() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const resultat = await debloquerCompteClient(client.id); setMessage(resultat.message); if (resultat.succes) router.refresh(); }
    finally { verrou.current = false; setEnCours(false); }
  }
  async function annuler(commandeId: string) {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const resultat = await annulerNoShowClient(commandeId); setMessage(resultat.message); if (resultat.succes) router.refresh(); }
    finally { verrou.current = false; setEnCours(false); }
  }
  const etat = client.bloque ? `Bloqué${client.bloque_le ? ` le ${new Date(client.bloque_le).toLocaleDateString("fr-FR")}` : ""}` : `${essaisRestants(client.no_shows)} essai${essaisRestants(client.no_shows) > 1 ? "s" : ""} restant${essaisRestants(client.no_shows) > 1 ? "s" : ""}`;
  return <div className="border-b border-trait py-3.5"><div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 flex-col gap-1"><span className="break-words text-sm font-light">{client.nom ?? "Client sans nom"}</span><span className="text-xs text-gris">{client.telephone ? telephoneLisible(client.telephone) : "Sans téléphone"} · {client.no_shows} no-show{client.no_shows > 1 ? "s" : ""}</span><span className="etiquette">{etat}</span>{message && <span role="status" className="text-sm">{message}</span>}</div>
    {client.bloque && <button type="button" disabled={enCours} onClick={() => void debloquer()} className="etiquette min-h-11 shrink-0 border border-noir px-3">Débloquer</button>}
  </div>
    {noShows.length > 0 && <ul className="mt-2 flex flex-col gap-1.5">{noShows.map(n => <li key={n.id} className="flex items-center justify-between gap-3 text-xs text-gris"><span>Commande n° {n.numero}{n.boutiques ? ` · ${n.boutiques.nom}` : ""}{n.no_show_le ? ` · ${formaterDateHeure(n.no_show_le)}` : ""}</span><button type="button" disabled={enCours} onClick={() => void annuler(n.id)} aria-label={`Annuler le no-show de la commande n° ${n.numero}`} className="etiquette min-h-11 shrink-0 border border-trait px-2.5 text-noir">Annuler</button></li>)}</ul>}
  </div>;
}
