"use client";
import Isole from "@/components/Isole";
import { useRef, useState } from "react";
import Prix from "@/components/Prix";
import Link from "next/link";
import { remettreCommandeRetrait } from "@/app/espace/retrait/actions";
import { formaterDateHeure } from "@/lib/commandes";
import type { CleRetrait, ResumeRetrait } from "@/lib/retrait";
import { aEncaisser, moisAlger, releveDuMois } from "@/lib/bons";
import { nomBon } from "@/lib/bons-boutique";
import { useLangue, useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";
import { traduireMessage } from "@/lib/textes/messages";

// US-26.3 : résumé d'une commande trouvée par QR code ou par code, puis « Remis au client » (maquette ⑥ et ⑦).
// Bon parrainage (US-27.4) : déduit seulement par QR code (relecture n°6, point 2).
// Le résumé ne remet rien : seule la touche « Remis au client » appelle la base.
export default function RetraitBoutique({ resume, cle, onAutre }: { resume: ResumeRetrait; cle: CleRetrait; onAutre?: () => void }) {
  const textes = useTextes(), t = textes.espace.retrait, langue = useLangue();
  const releve = (mois: string) => releveDuMois(mois, langue, t);
  /** Texte avec un {montant} rendu par <Prix> (chiffres et DA bien placés en arabe). */
  const avecPrix = (modele: string, montant: number, valeurs: Record<string, string | number> = {}) => { const [avant, apres] = remplir(modele, valeurs).split("{montant}"); return <>{avant}<Prix montant={montant} langue={langue} />{apres}</>; };
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
  const libelleBon = nomBon(resume.bon, textes.parrainage, langue);

  async function remettre() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try {
      const resultat = await remettreCommandeRetrait(cle);
      if (resultat.succes) setRemise(resultat.resume ?? resume);
      else setMessage(resultat.message);
    } catch { setMessage(t.impossible); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const autre = onAutre
    ? <button type="button" onClick={onAutre} className="etiquette min-h-12 w-full bg-noir text-blanc">{t.scannerAutre}</button>
    : <Link href="/espace/scanner" className="etiquette flex min-h-12 w-full items-center justify-center bg-noir text-blanc">{t.scannerAutre}</Link>;

  if (remise) return <section aria-label={t.remise} className="flex flex-col items-center gap-3 px-6 py-10 text-center">
    <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full border border-noir text-2xl">✓</span>
    <h2 role="status" className="font-titre text-[26px] font-normal">{t.remise}</h2>
    <p className="text-sm">{avecPrix(t.remiseTexte, aEncaisser(remise.total ?? 0, remise.remise_bon ?? bon), { n: remise.numero ?? "" })}</p>
    {(remise.remise_bon ?? bon) > 0 && <p className="text-sm text-gris">{avecPrix(t.bonRembourse, remise.remise_bon ?? bon, { bon: libelleBon, releve: releve(moisAlger(remise.terminee_le ? new Date(remise.terminee_le) : new Date())) })}</p>}
    <div className="mt-3 w-full">{autre}</div>
    <Link href="/espace/commandes" className="text-sm underline">{t.voirCommandes}</Link>
  </section>;

  return <section aria-label={remplir(textes.espace.carte.commande, { n: resume.numero ?? "" })} className="px-6 py-5">
    <p className="etiquette text-gris">{remplir(t.trouvee, { mode: parCode ? t.parCode : t.parQr })}</p>
    <h2 className="mt-1 font-titre text-[24px] font-normal leading-tight">{langue === "ar" ? <>{remplir(textes.espace.carte.commande, { n: resume.numero ?? "" })}{resume.prenom && <> · <bdi>{resume.prenom}</bdi></>}</> : remplir(textes.espace.carte.commande, { n: resume.numero ?? "" }) + (resume.prenom ? ` · ${resume.prenom}` : "")}</h2>
    {resume.expire_le && <p className="mt-1 text-sm text-gris">{remplir(t.prete, { date: formaterDateHeure(resume.expire_le, langue) })}</p>}
    <ul aria-label={t.articles} className="mt-4 border-t border-trait pt-2 text-[13px] font-light">{(resume.lignes ?? []).map((l, i) =>
      <li key={i} className="flex justify-between gap-3 border-b border-trait py-2"><span><Isole langue={langue}>{l.titre}</Isole> · <Isole langue={langue}>{l.taille}</Isole> × {l.quantite}</span><span className="whitespace-nowrap"><Prix montant={l.prix_unitaire * l.quantite} langue={langue} /></span></li>)}</ul>
    {bon > 0 && <dl className="mt-3 text-sm">
      <div className="flex justify-between py-1"><dt>{t.sousTotal}</dt><dd><Prix montant={total} langue={langue} /></dd></div>
      <div className="flex justify-between py-1"><dt>{remplir(t.bonBleDeal, { bon: libelleBon })}</dt><dd><Prix montant={bon} moins langue={langue} /></dd></div>
    </dl>}
    <p className="mt-4 flex items-center justify-between gap-3 bg-noir px-4 py-3 text-blanc"><span className="etiquette">{t.aEncaisser}</span><span className="text-[22px] font-medium whitespace-nowrap"><Prix montant={aEncaisser(total, bon)} langue={langue} /></span></p>
    {bon > 0 && <p className="mt-2 border border-noir p-3 text-sm">{avecPrix(t.rembourses, bon, { releve: releve(moisAlger()) })}</p>}
    {parCode && <div className="mt-3 border border-noir p-3 text-sm">
      {bonReserve > 0 && <p className="font-medium">{avecPrix(t.parCodeBon, total)}</p>}
      <p className={bonReserve > 0 ? "mt-1" : ""}>{t.parCodeRemise}</p>
    </div>}
    <p className="mt-3 text-sm text-gris">{t.verifier}</p>
    <button type="button" disabled={enCours} onClick={() => void remettre()} className="etiquette mt-4 min-h-12 w-full bg-noir text-blanc">{t.remis}</button>
    {message && <p role="alert" className="mt-3 border border-trait p-3 text-sm">{traduireMessage(message, langue)}</p>}
    <div className="mt-3 text-center">{onAutre
      ? <button type="button" onClick={onAutre} className="min-h-11 text-sm underline">{textes.espace.commun.retour}</button>
      : <Link href="/espace/commandes" className="inline-flex min-h-11 items-center text-sm underline">{textes.espace.commun.retour}</Link>}</div>
  </section>;
}
