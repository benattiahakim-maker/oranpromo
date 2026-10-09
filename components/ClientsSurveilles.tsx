"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { debloquerCompteClient } from "@/app/admin/clients/actions";
import { essaisRestants, telephoneLisible, type ClientSurveille } from "@/lib/clients";

// US-20.4 : clients bloqués (bouton Débloquer) et clients avec des no-shows.
export default function ClientsSurveilles({ bloques, avecNoShows }: { bloques: ClientSurveille[]; avecNoShows: ClientSurveille[] }) {
  return <>
    <h2 className="etiquette mt-6">Bloqués ({bloques.length})</h2>
    {bloques.length ? <ul>{bloques.map(c => <li key={c.id}><LigneClient client={c} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun client bloqué.</p>}
    <h2 className="etiquette mt-6">Avec des no-shows ({avecNoShows.length})</h2>
    {avecNoShows.length ? <ul>{avecNoShows.map(c => <li key={c.id}><LigneClient client={c} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun no-show.</p>}
    <p className="mt-4 text-xs leading-[1.6] text-gris">Une commande prête non récupérée sous 24 h compte comme un no-show. Au 5e, le compte est bloqué. Débloquer remet le compteur à 0.</p>
  </>;
}

function LigneClient({ client }: { client: ClientSurveille }) {
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
  const etat = client.bloque ? `Bloqué${client.bloque_le ? ` le ${new Date(client.bloque_le).toLocaleDateString("fr-FR")}` : ""}` : `${essaisRestants(client.no_shows)} essai${essaisRestants(client.no_shows) > 1 ? "s" : ""} restant${essaisRestants(client.no_shows) > 1 ? "s" : ""}`;
  return <div className="flex items-center justify-between gap-3 border-b border-trait py-3.5">
    <div className="flex min-w-0 flex-col gap-1"><span className="break-words text-sm font-light">{client.nom ?? "Client sans nom"}</span><span className="text-xs text-gris">{client.telephone ? telephoneLisible(client.telephone) : "Sans téléphone"} · {client.no_shows} no-show{client.no_shows > 1 ? "s" : ""}</span><span className="etiquette">{etat}</span>{message && <span role="status" className="text-sm">{message}</span>}</div>
    {client.bloque && <button type="button" disabled={enCours} onClick={() => void debloquer()} className="etiquette min-h-11 shrink-0 border border-noir px-3">Débloquer</button>}
  </div>;
}
