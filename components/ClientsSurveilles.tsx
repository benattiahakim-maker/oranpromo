"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { annulerNoShowClient, bloquerCompteClient, debloquerCompteClient, validerNoShowClient } from "@/app/admin/clients/actions";
import { essaisRestants, noShowsDuClient, telephoneLisible, type ClientSurveille, type ContestationEnAttente, type NoShowDeclare } from "@/lib/clients";
import { formaterDateHeure } from "@/lib/commandes";

// US-20.4 : contestations, clients bloqués (Débloquer), clients avec des no-shows (Bloquer).
// US-21.3 : plus de section « numéro partagé » : un numéro vérifié n’appartient qu’à un compte.
export default function ClientsSurveilles({ bloques, avecNoShows, noShows = [], contestations = [] }: { bloques: ClientSurveille[]; avecNoShows: ClientSurveille[]; noShows?: NoShowDeclare[]; contestations?: ContestationEnAttente[] }) {
  return <>
    <section aria-labelledby="contestations">
      <h2 id="contestations" className="etiquette mt-6">Contestations en attente ({contestations.length})</h2>
      {contestations.length ? <ul>{contestations.map(c => <li key={c.id}><LigneContestation contestation={c} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucune contestation en attente.</p>}
      <p className="mt-2 text-xs leading-[1.6] text-gris">Tant que la contestation est en attente, le no-show ne compte pas pour le blocage. Valider : il compte de nouveau. Annuler : il est retiré.</p>
    </section>
    <h2 className="etiquette mt-6">Bloqués ({bloques.length})</h2>
    {bloques.length ? <ul>{bloques.map(c => <li key={c.id}><LigneClient client={c} noShows={noShowsDuClient(c, noShows)} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun client bloqué.</p>}
    <h2 className="etiquette mt-6">Avec des no-shows ({avecNoShows.length})</h2>
    {avecNoShows.length ? <ul>{avecNoShows.map(c => <li key={c.id}><LigneClient client={c} noShows={noShowsDuClient(c, noShows)} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun no-show.</p>}
    <p className="mt-4 text-xs leading-[1.6] text-gris">Un no-show est compté quand la boutique signale « Client pas venu » sur une commande prête non récupérée sous 24 h. Les no-shows comptent pour le compte qui a passé la commande, et pour le numéro quand il est vérifié par code (un numéro vérifié n’appartient qu’à un compte ; un numéro saisi à la main ne compte jamais pour un autre compte). Au 5e, le compte est bloqué. Annuler un no-show baisse le compteur ; Débloquer le remet à 0 ; Bloquer interdit de commander jusqu’au déblocage.</p>
  </>;
}

function LigneClient({ client, noShows }: { client: ClientSurveille; noShows: NoShowDeclare[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function basculerBlocage() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const resultat = client.bloque ? await debloquerCompteClient(client.id) : await bloquerCompteClient(client.id); setMessage(resultat.message); if (resultat.succes) router.refresh(); }
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
    <div className="flex min-w-0 flex-col gap-1"><span className="break-words text-sm font-light">{client.nom ?? "Client sans nom"}</span><span className="text-xs text-gris">{client.telephone ? `${telephoneLisible(client.telephone)}${client.telephone_verifie_le ? " (vérifié)" : ""}` : "Sans téléphone"} · {client.no_shows} no-show{client.no_shows > 1 ? "s" : ""}</span><span className="etiquette">{etat}</span>{message && <span role="status" className="text-sm">{message}</span>}</div>
    <button type="button" disabled={enCours} onClick={() => void basculerBlocage()} aria-label={`${client.bloque ? "Débloquer" : "Bloquer"} ${client.nom ?? "ce client"}`} className="etiquette min-h-11 shrink-0 border border-noir px-3">{client.bloque ? "Débloquer" : "Bloquer"}</button>
  </div>
    {noShows.length > 0 && <ul className="mt-2 flex flex-col gap-1.5">{noShows.map(n => <li key={n.id} className="flex items-center justify-between gap-3 text-xs text-gris"><span>Commande n° {n.numero}{n.boutiques ? ` · ${n.boutiques.nom}` : ""}{n.no_show_le ? ` · ${formaterDateHeure(n.no_show_le)}` : ""}</span><button type="button" disabled={enCours} onClick={() => void annuler(n.id)} aria-label={`Annuler le no-show de la commande n° ${n.numero}`} className="etiquette min-h-11 shrink-0 border border-trait px-2.5 text-noir">Annuler</button></li>)}</ul>}
  </div>;
}

function LigneContestation({ contestation: c }: { contestation: ContestationEnAttente }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function agir(action: "valider" | "annuler") {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const resultat = action === "valider" ? await validerNoShowClient(c.id) : await annulerNoShowClient(c.id); setMessage(resultat.message); if (resultat.succes) router.refresh(); }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <div className="border-b border-trait py-3.5">
    <p className="text-sm font-light">{c.client_nom} · {telephoneLisible(c.client_telephone)}</p>
    <p className="text-xs text-gris">Commande n° {c.numero}{c.boutiques ? ` · ${c.boutiques.nom}` : ""}{c.no_show_le ? ` · no-show du ${formaterDateHeure(c.no_show_le)}` : ""}{c.contestee_le ? ` · contesté le ${formaterDateHeure(c.contestee_le)}` : ""}</p>
    {c.contestations?.motif && <p className="mt-1 break-words text-sm">« {c.contestations.motif} »</p>}
    <div className="mt-2 flex gap-2">
      <button type="button" disabled={enCours} onClick={() => void agir("valider")} aria-label={`Valider le no-show de la commande n° ${c.numero}`} className="etiquette min-h-11 flex-1 border border-noir px-3">Valider le no-show</button>
      <button type="button" disabled={enCours} onClick={() => void agir("annuler")} aria-label={`Annuler le no-show contesté de la commande n° ${c.numero}`} className="etiquette min-h-11 flex-1 border border-trait px-3">Annuler le no-show</button>
    </div>
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </div>;
}
