"use client";
import { useRef, useState } from "react";
import Prix from "@/components/Prix";
import Link from "next/link";
import { remettreCommandeRetrait } from "@/app/espace/retrait/actions";
import { formaterDateHeure } from "@/lib/commandes";
import type { CleRetrait, ResumeRetrait } from "@/lib/retrait";
import { aEncaisser, moisAlger, releveDuMois } from "@/lib/bons";
import { nomBon } from "@/lib/bons-boutique";

// US-26.3 : résumé d'une commande trouvée par QR code ou par code, puis « Remis au client » (maquette ⑥ et ⑦).
// Bon parrainage (US-27.4) : déduit seulement par QR code (relecture n°6, point 2).
// Le résumé ne remet rien : seule la touche « Remis au client » appelle la base.
export default function RetraitBoutique({ resume, cle, onAutre }: { resume: ResumeRetrait; cle: CleRetrait; onAutre?: () => void }) {
  const [remise, setRemise] = useState<ResumeRetrait | null>(null);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const parCode = "code" in cle;
  // US-27.4 : bon parrainage BleDeal déduit du montant à encaisser, remboursé à la boutique sur le relevé du mois de la remise.
  // Relecture n°6, point 2 : seulement par QR code. Par code, la base rend le bon au client : la boutique encaisse le total.
  const bonReserve = resume.remise_bon ?? 0;
  const bon = parCode ? 0 : bonReserve;
  const total = resume.total ?? 0;
  // US-33.4 : « Bon Aïd 2026 », « Bon de bienvenue », « Bon parrainage ».
  const libelleBon = nomBon(resume.bon);

  async function remettre() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try {
      const resultat = await remettreCommandeRetrait(cle);
      if (resultat.succes) setRemise(resultat.resume ?? resume);
      else setMessage(resultat.message);
    } catch { setMessage("Impossible de remettre la commande. Vérifiez votre connexion."); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const autre = onAutre
    ? <button type="button" onClick={onAutre} className="etiquette min-h-12 w-full bg-noir text-blanc">Scanner une autre commande</button>
    : <Link href="/espace/scanner" className="etiquette flex min-h-12 w-full items-center justify-center bg-noir text-blanc">Scanner une autre commande</Link>;

  if (remise) return <section aria-label="Commande remise" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
    <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full border border-noir text-2xl">✓</span>
    <h2 role="status" className="font-titre text-[26px] font-normal">Commande remise</h2>
    <p className="text-sm">N° {remise.numero} · <Prix montant={aEncaisser(remise.total ?? 0, remise.remise_bon ?? bon)} /> · Elle passe en « Récupérée ». Le stock était déjà à jour.</p>
    {(remise.remise_bon ?? bon) > 0 && <p className="text-sm text-gris">{libelleBon} de <Prix montant={remise.remise_bon ?? bon} /> : BleDeal vous le rembourse ({releveDuMois(moisAlger(remise.terminee_le ? new Date(remise.terminee_le) : new Date()))}).</p>}
    <div className="mt-3 w-full">{autre}</div>
    <Link href="/espace/commandes" className="text-sm underline">Voir les commandes</Link>
  </section>;

  return <section aria-label={`Commande n° ${resume.numero}`} className="px-6 py-5">
    <p className="etiquette text-gris">Commande trouvée · {parCode ? "par code" : "par QR code"}</p>
    <h2 className="mt-1 font-titre text-[24px] font-normal leading-tight">Commande n° {resume.numero}{resume.prenom ? ` · ${resume.prenom}` : ""}</h2>
    {resume.expire_le && <p className="mt-1 text-sm text-gris">Prête · jusqu’au {formaterDateHeure(resume.expire_le)}</p>}
    <ul aria-label="Articles" className="mt-4 border-t border-trait pt-2 text-[13px] font-light">{(resume.lignes ?? []).map((l, i) =>
      <li key={i} className="flex justify-between gap-3 border-b border-trait py-2"><span>{l.titre} · {l.taille} × {l.quantite}</span><span className="whitespace-nowrap"><Prix montant={l.prix_unitaire * l.quantite} /></span></li>)}</ul>
    {bon > 0 && <dl className="mt-3 text-sm">
      <div className="flex justify-between py-1"><dt>Sous-total</dt><dd><Prix montant={total} /></dd></div>
      <div className="flex justify-between py-1"><dt>{libelleBon} BleDeal</dt><dd><Prix montant={bon} moins /></dd></div>
    </dl>}
    <p className="mt-4 flex items-center justify-between gap-3 bg-noir px-4 py-3 text-blanc"><span className="etiquette">À encaisser en espèces</span><span className="text-[22px] font-medium whitespace-nowrap"><Prix montant={aEncaisser(total, bon)} /></span></p>
    {bon > 0 && <p className="mt-2 border border-noir p-3 text-sm">Ces <Prix montant={bon} /> vous sont remboursés par BleDeal ({releveDuMois(moisAlger())}).</p>}
    {parCode && <div className="mt-3 border border-noir p-3 text-sm">
      {bonReserve > 0 && <p className="font-medium">Par code, le bon ne s’applique pas : encaissez <Prix montant={total} />. Le bon reste au client.</p>}
      <p className={bonReserve > 0 ? "mt-1" : ""}>Remise par code : ni bon parrainage ni parrainage BleDeal. Scannez plutôt le QR code du client.</p>
    </div>}
    <p className="mt-3 text-sm text-gris">Vérifiez les articles avec le client avant de remettre. Un proche peut venir à sa place : c’est normal.</p>
    <button type="button" disabled={enCours} onClick={() => void remettre()} className="etiquette mt-4 min-h-12 w-full bg-noir text-blanc">Remis au client</button>
    {message && <p role="alert" className="mt-3 border border-trait p-3 text-sm">{message}</p>}
    <div className="mt-3 text-center">{onAutre
      ? <button type="button" onClick={onAutre} className="min-h-11 text-sm underline">Retour</button>
      : <Link href="/espace/commandes" className="inline-flex min-h-11 items-center text-sm underline">Retour</Link>}</div>
  </section>;
}
