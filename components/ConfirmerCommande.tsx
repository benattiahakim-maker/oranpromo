"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { confirmerCommandeDepuisLien } from "@/app/confirmer/actions";
import type { ResultatConfirmation } from "@/lib/confirmation";

// US-20.6 : un seul bouton ; ouvrir la page ne confirme rien.
export default function ConfirmerCommande({ jeton }: { jeton: string }) {
  const [resultat, setResultat] = useState<ResultatConfirmation | null>(null);
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function confirmer() {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true);
    try { setResultat(await confirmerCommandeDepuisLien(jeton)); }
    finally { verrou.current = false; setEnCours(false); }
  }
  if (resultat?.succes) return <p role="status" className="border border-noir p-3 text-sm">✓ {resultat.message} <Link href="/espace/commandes" className="underline">Voir mes commandes</Link></p>;
  const termine = resultat && resultat.etat !== "erreur";
  return <div className="flex flex-col gap-3">
    {!termine && <button type="button" disabled={enCours} onClick={() => void confirmer()} className="etiquette min-h-[52px] w-full bg-noir text-blanc disabled:opacity-60">{enCours ? "Confirmation…" : "Confirmer la commande"}</button>}
    {!termine && <p className="text-center text-xs text-gris">Le stock baisse à la confirmation. Lien valable 24 h.</p>}
    {resultat && <p role={resultat.etat === "deja_confirmee" ? "status" : "alert"} className="border border-trait p-3 text-sm">{resultat.message}{resultat.etat === "stock" && <> <Link href="/espace/commandes" className="underline">Corriger le stock ou annuler</Link></>}</p>}
    <Link href="/espace/commandes" className="text-center text-xs underline">Annuler ou voir toutes mes commandes</Link>
  </div>;
}
