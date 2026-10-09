"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { remettreCommandeRetrait } from "@/app/espace/retrait/actions";
import { formaterDateHeure } from "@/lib/commandes";
import { formaterPrix } from "@/lib/prix";
import type { CleRetrait, ResumeRetrait } from "@/lib/retrait";

// US-26.3 : résumé d'une commande trouvée par QR code ou par code, puis « Remis au client » (maquette ⑥ et ⑦).
// Le résumé ne remet rien : seule la touche « Remis au client » appelle la base.
export default function RetraitBoutique({ resume, cle, onAutre }: { resume: ResumeRetrait; cle: CleRetrait; onAutre?: () => void }) {
  const [remise, setRemise] = useState<ResumeRetrait | null>(null);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const parCode = "code" in cle;

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
    <p className="text-sm">N° {remise.numero} · {formaterPrix(remise.total ?? 0)} · Elle passe en « Récupérée ». Le stock était déjà à jour.</p>
    <div className="mt-3 w-full">{autre}</div>
    <Link href="/espace/commandes" className="text-sm underline">Voir les commandes</Link>
  </section>;

  return <section aria-label={`Commande n° ${resume.numero}`} className="px-6 py-5">
    <p className="etiquette text-gris">Commande trouvée · {parCode ? "par code" : "par QR code"}</p>
    <h2 className="mt-1 font-titre text-[24px] font-normal leading-tight">Commande n° {resume.numero}{resume.prenom ? ` · ${resume.prenom}` : ""}</h2>
    {resume.expire_le && <p className="mt-1 text-sm text-gris">Prête · jusqu’au {formaterDateHeure(resume.expire_le)}</p>}
    <ul aria-label="Articles" className="mt-4 border-t border-trait pt-2 text-[13px] font-light">{(resume.lignes ?? []).map((l, i) =>
      <li key={i} className="flex justify-between gap-3 border-b border-trait py-2"><span>{l.titre} · {l.taille} × {l.quantite}</span><span className="whitespace-nowrap">{formaterPrix(l.prix_unitaire * l.quantite)}</span></li>)}</ul>
    <p className="mt-4 flex items-center justify-between gap-3 bg-noir px-4 py-3 text-blanc"><span className="etiquette">À encaisser en espèces</span><span className="text-[22px] font-medium whitespace-nowrap">{formaterPrix(resume.total ?? 0)}</span></p>
    <p className="mt-3 text-sm text-gris">Vérifiez les articles avec le client avant de remettre. Un proche peut venir à sa place : c’est normal.</p>
    <button type="button" disabled={enCours} onClick={() => void remettre()} className="etiquette mt-4 min-h-12 w-full bg-noir text-blanc">Remis au client</button>
    {message && <p role="alert" className="mt-3 border border-trait p-3 text-sm">{message}</p>}
    <div className="mt-3 text-center">{onAutre
      ? <button type="button" onClick={onAutre} className="min-h-11 text-sm underline">Retour</button>
      : <Link href="/espace/commandes" className="inline-flex min-h-11 items-center text-sm underline">Retour</Link>}</div>
  </section>;
}
