"use client";
import { useState } from "react";
import Prix from "@/components/Prix";
import { useLangue, useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";
import { aEncaisser } from "@/lib/bons";

// US-26.2 : QR code de retrait, code à 6 chiffres (6 cases de 40 px, 270 px en tout : tient à 375 px) et montant à payer (page du client et page du proche).
// Le QR code est calculé par le serveur (adresse data: d'un SVG) ; le jeton n'apparaît pas en clair ici.
export default function BlocRetrait({ qr, code, numero, total, remise = 0, libelleBon, partage }: {
  qr: string; code: string; numero: number; total: number;
  /** US-27.4 : bon parrainage posé sur la commande (300 DA), déduit du montant à payer. */
  remise?: number;
  /** US-33.4 : « Bon Aïd 2026 », « Bon de bienvenue » ; absent : « Bon parrainage ». */
  libelleBon?: string;
  /** Seulement pour le client : lien de la page du proche et lien « Envoyer à un proche » (WhatsApp). */
  partage?: { lien: string; whatsapp: string };
}) {
  const t = useTextes().retrait;
  const tBon = useTextes().parrainage;
  const langue = useLangue();
  const [message, setMessage] = useState("");

  async function copier() {
    if (!partage) return;
    try { await navigator.clipboard.writeText(partage.lien); setMessage(t.copie); }
    catch { setMessage(t.copieImpossible); }
  }

  return <>
    <section aria-label={t.bloc} className="border border-noir px-4 py-5 text-center">
      <h2 className="etiquette mb-1.5 font-medium">{t.bloc}</h2>
      <p className="mb-3 text-sm">{t.consigne}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG en adresse data:, rien à optimiser */}
      <img src={qr} alt={remplir(t.altQr, { n: numero })} width={232} height={232} className="mx-auto h-[232px] w-[232px]" />
      <p className="mt-2.5 text-xs text-gris">{t.sansCamera}</p>
      <p aria-label={t.code} dir="ltr" className="mt-1 flex justify-center gap-1.5">{code.split("").map((chiffre, i) =>
        <span key={i} className="flex h-[50px] w-10 items-center justify-center border border-noir text-[24px]">{chiffre}</span>)}</p>
      {remise > 0 && <p className="mt-3.5 flex justify-between border-t border-trait pt-2.5 text-sm"><span>{libelleBon ?? tBon.ligneBon}</span><Prix montant={remise} langue={langue} moins /></p>}
      <p className={`flex justify-between pt-2.5 ${remise > 0 ? "mt-1" : "mt-3.5 border-t border-trait"}`}><span className="etiquette self-center">{t.aPayer}</span><strong className="text-lg font-medium"><Prix montant={aEncaisser(total, remise)} langue={langue} /></strong></p>
      <p className="mt-2 text-xs text-gris">{t.luminosite}</p>
    </section>
    {partage && <div className="mt-3.5 flex flex-col gap-2.5">
      <a href={partage.whatsapp} target="_blank" rel="noopener noreferrer" className="etiquette flex min-h-12 items-center justify-center border border-noir px-3 text-center">{t.envoyerProche}</a>
      <button type="button" onClick={() => void copier()} className="flex min-h-11 items-center justify-center text-sm text-gris underline">{t.copier}</button>
      {message && <p role="status" className="text-center text-sm">{message}</p>}
      <p className="text-center text-xs text-gris">{t.avertissement}</p>
    </div>}
  </>;
}
