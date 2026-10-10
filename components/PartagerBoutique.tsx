"use client";

import { useState } from "react";
import Link from "next/link";
import type { PartageBoutique } from "@/lib/lien-boutique";

// US-22 : bloc « Partager ma boutique » de l'espace commerçant.
export default function PartagerBoutique({ partage }: { partage: PartageBoutique }) {
  const [message, setMessage] = useState("");
  async function copier() {
    try { await navigator.clipboard.writeText(partage.lien); setMessage("Lien copié"); }
    catch { setMessage("Copie impossible : sélectionnez le lien et copiez-le."); }
  }
  return <section aria-labelledby="partager-boutique" className="mt-8 border-t border-trait pt-6">
    <h2 id="partager-boutique" className="etiquette text-center">Partager ma boutique</h2>
    {partage.statut === "validee" ? <>
      <p className="mt-3 text-center text-sm text-gris">Mettez ce lien dans votre bio Instagram, TikTok ou Facebook, et envoyez-le sur WhatsApp.</p>
      <p className="mt-4 select-all break-all border border-trait px-3 py-3 text-center text-sm" data-testid="lien-boutique">{partage.lien}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={copier} className="etiquette flex min-h-12 items-center justify-center border border-noir px-2">Copier le lien</button>
        <a href={partage.lienWhatsApp ?? undefined} target="_blank" rel="noopener noreferrer" className="etiquette flex min-h-12 items-center justify-center bg-noir px-2 text-blanc">Partager sur WhatsApp</a>
      </div>
      <p role="status" className="mt-2 min-h-5 text-center text-xs">{message}</p>
      {partage.qrCode && <div className="mt-2 flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré localement (adresse data:), rien à optimiser */}
        <img src={partage.qrCode} alt={`QR code du lien de ${partage.nom}`} width={200} height={200} className="h-[200px] w-[200px]" />
        <div className="grid w-full grid-cols-2 gap-3">
          <a href={partage.qrCode} download={partage.fichierQrCode} className="etiquette flex min-h-12 items-center justify-center border border-noir px-2 text-center">Télécharger le QR code</a>
          <Link href="/espace/affiche" className="etiquette flex min-h-12 items-center justify-center border border-noir px-2 text-center">Imprimer l’affiche</Link>
        </div>
      </div>}
    </> : <p role="status" className="mt-3 text-center text-sm">{partage.statut === "suspendue" ? "Votre boutique est suspendue : son lien affiche « Boutique indisponible »." : "Votre lien sera actif dès que votre boutique sera validée par BleDeal."}</p>}
  </section>;
}
