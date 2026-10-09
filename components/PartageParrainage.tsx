"use client";
import { useState } from "react";
import { useTextes } from "./FournisseurTextes";

/** Lien d'invitation prêt à partager (calculé par le serveur : lib/parrainage.ts). */
export type LienInvitation = { code: string; lien: string; whatsapp: string; qr?: string | null };

// US-27.3 : code, lien /p/<code>, « Partager sur WhatsApp » (wa.me sans numéro), « Copier le lien », QR code du lien.
export default function PartageParrainage({ invitation, cadre = true }: { invitation: LienInvitation; cadre?: boolean }) {
  const t = useTextes().parrainage;
  const [message, setMessage] = useState("");
  async function copier() {
    try { await navigator.clipboard.writeText(invitation.lien); setMessage(t.lienCopie); }
    catch { setMessage(t.copieImpossible); }
  }
  return <div className={cadre ? "border border-noir p-4" : ""}>
    <p className="flex items-baseline justify-between gap-3"><span className="etiquette text-xs text-gris">{t.tonCode}</span><strong dir="ltr" className="font-titre text-[28px] font-normal tracking-[4px]">{invitation.code}</strong></p>
    {cadre && <p dir="ltr" className="mt-3 select-all break-all border border-trait px-3 py-3 text-sm" data-testid="lien-parrainage">{invitation.lien.replace(/^https?:\/\//, "")}</p>}
    <a href={invitation.whatsapp} target="_blank" rel="noopener noreferrer" className="etiquette mt-3 flex min-h-12 items-center justify-center bg-noir px-3 text-center text-blanc">{t.partagerWhatsApp}</a>
    <button type="button" onClick={() => void copier()} className="etiquette mt-2.5 flex min-h-12 w-full items-center justify-center border border-noir">{t.copierLien}</button>
    <p role="status" className="mt-1 min-h-5 text-center text-xs">{message}</p>
    {invitation.qr && <div className="mt-1 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré par le serveur (adresse data:), rien à optimiser */}
      <img src={invitation.qr} alt={t.qrAlt} width={96} height={96} className="h-24 w-24 shrink-0" />
      <p className="text-xs leading-[1.6] text-gris">{t.qrTexte}</p>
    </div>}
  </div>;
}
