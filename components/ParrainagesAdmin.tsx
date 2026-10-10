"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ActionMotif from "@/components/ActionMotif";
import { annulerBonsParrainage, exclureCompteDuParrainage, retirerBoutiqueDesBons } from "@/app/admin/parrainages/actions";
import { bonsAnnulables, masquerTelephone, montantDA, STATUTS_PARRAINAGE, type ParrainageAdmin } from "@/lib/parrainage-admin";
import { formaterDateHeure } from "@/lib/commandes";

// US-27.5 : liste des parrainages, signaux (jamais bloquants), actions admin.
const MODES: Record<string, string> = { qr: "QR code", code: "code à 6 chiffres", manuel: "sans QR code" };
const ETATS_BON: Record<string, string> = { en_file: "en file", disponible: "disponible", reserve: "réservé", utilise: "utilisé", expire: "expiré", annule: "annulé" };

export default function ParrainagesAdmin({ parrainages, signaux }: { parrainages: ParrainageAdmin[]; signaux: Record<string, string[]> }) {
  const avecSignal = parrainages.filter(p => signaux[p.filleul_id]?.length).length;
  return <section aria-labelledby="liste-parrainages" className="mt-6">
    <h2 id="liste-parrainages" className="etiquette">Parrainages ({parrainages.length}){avecSignal ? ` · ${avecSignal} avec signal` : ""}</h2>
    {parrainages.length ? <ul>{parrainages.map(p => <li key={p.filleul_id}><Ligne p={p} signaux={signaux[p.filleul_id] ?? []} /></li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun parrainage pour l’instant.</p>}
    <p className="mt-4 text-xs leading-[1.6] text-gris">Les signaux aident à repérer la triche ; ils ne bloquent rien. « Annuler les bons » annule les bons pas encore utilisés (un bon réservé reste sur sa commande). « Exclure » : le compte ne peut plus parrainer. « Retirer la boutique » : ses nouvelles commandes ne portent plus de bon ; prévenez-la hors du site.</p>
  </section>;
}

function Personne({ titre, personne, absent = "Compte supprimé" }: { titre: string; personne: ParrainageAdmin["filleul"]; absent?: string }) {
  return <p className="text-xs text-gris"><span className="text-noir">{titre} : {personne?.nom ?? absent}</span>{personne && ` · ${masquerTelephone(personne.telephone)} · inscrit le ${formaterDateHeure(personne.cree_le)}`}{personne?.parrainage_exclu ? " · exclu" : ""}{personne?.bloque ? " · bloqué" : ""}</p>;
}

function Bascule({ libelle, etiquette, action }: { libelle: string; etiquette: string; action: () => Promise<{ succes: boolean; message: string }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function agir() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const r = await action(); setMessage(r.message); if (r.succes) router.refresh(); }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <div className="mt-2"><button type="button" disabled={enCours} onClick={() => void agir()} aria-label={etiquette} className="etiquette min-h-11 border border-trait px-3">{libelle}</button>{message && <p role="status" className="mt-1 text-sm">{message}</p>}</div>;
}

function Ligne({ p, signaux }: { p: ParrainageAdmin; signaux: string[] }) {
  const annulables = bonsAnnulables(p);
  return <div className="border-b border-trait py-3.5">
    <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-sm">{p.filleul?.nom ?? "Compte supprimé"}</span><span className="etiquette shrink-0 whitespace-nowrap">{STATUTS_PARRAINAGE[p.statut] ?? p.statut}</span></div>
    <Personne titre="Filleul" personne={p.filleul} />
    <Personne titre="Parrain" personne={p.parrain} absent={p.parrain_id ? "Compte supprimé" : "aucun (numéro ou code sans parrain possible)"} />
    {p.commande && <p className="text-xs text-gris">Commande n° {p.commande.numero} · {montantDA(p.commande.total)}{p.boutique ? ` · ${p.boutique.nom}` : ""}{p.commande.mode_remise ? ` · ${MODES[p.commande.mode_remise] ?? p.commande.mode_remise}` : ""}</p>}
    {p.valide_le && <p className="text-xs text-gris">Validé le {formaterDateHeure(p.valide_le)}</p>}
    {p.bons.length > 0 && <p className="text-xs text-gris">Bons : {p.bons.map(b => `${b.origine === "parrainage_parrain" ? "parrain" : "filleul"} ${ETATS_BON[b.statut] ?? b.statut}`).join(" · ")}</p>}
    {p.motif && <p className="text-xs text-gris">Motif : {p.motif}</p>}
    {signaux.length > 0 && <ul className="mt-2 border-l-2 border-noir pl-2">{signaux.map(s => <li key={s} className="text-xs font-medium">Signal : {s}</li>)}</ul>}
    <div className="flex flex-wrap gap-x-2">
      {annulables > 0 && p.statut !== "annule" && <ActionMotif libelle="Annuler les bons" confirmer="Annuler les bons" etiquette={`Annuler les bons du parrainage de ${p.filleul?.nom ?? "ce filleul"}`} aide={`${annulables} bon${annulables > 1 ? "s" : ""} pas encore utilisé${annulables > 1 ? "s" : ""} ; un bon utilisé ou réservé ne change pas.`} action={motif => annulerBonsParrainage(p.filleul_id, motif)} />}
      {p.parrain && <Bascule libelle={p.parrain.parrainage_exclu ? "Réadmettre le parrain" : "Exclure le parrain"} etiquette={`${p.parrain.parrainage_exclu ? "Réadmettre" : "Exclure"} ${p.parrain.nom ?? "le parrain"} du parrainage`} action={() => exclureCompteDuParrainage(p.parrain!.id, !p.parrain!.parrainage_exclu)} />}
      {p.boutique && <Bascule libelle={p.boutique.bons_acceptes ? "Retirer la boutique des bons" : "Réaccepter la boutique"} etiquette={`${p.boutique.bons_acceptes ? "Retirer" : "Réaccepter"} ${p.boutique.nom} pour les bons`} action={() => retirerBoutiqueDesBons(p.boutique!.id, p.boutique!.bons_acceptes)} />}
    </div>
  </div>;
}
