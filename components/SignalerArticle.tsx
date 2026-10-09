"use client";

import { useState } from "react";
import { envoyerSignalement } from "@/app/visiteurs/actions";
import { useTextes } from "./FournisseurTextes";

export default function SignalerArticle({ articleId }: { articleId: string }) {
  const t = useTextes().signaler;
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enCours || envoye) return;
    const donnees = new FormData(event.currentTarget);
    const motif = String(donnees.get("motif") ?? "");
    const commentaire = String(donnees.get("commentaire") ?? "").trim();
    if (!["contrefacon", "contenu_inapproprie", "arnaque", "autre"].includes(motif)) { setMessage(t.choisirMotif); return; }
    setEnCours(true); setMessage("");
    try {
      const resultat = await envoyerSignalement(articleId, motif, commentaire);
      if (resultat.succes) { setEnvoye(true); setOuvert(false); }
      setMessage(resultat.message);
    } catch { setMessage(t.echec); }
    finally { setEnCours(false); }
  }
  return <section className="px-6 pb-8 text-center">
    {!envoye && <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} className="etiquette min-h-11 text-xs text-gris underline">{t.bouton}</button>}
    {ouvert && <form onSubmit={envoyer} className="mt-3 flex flex-col gap-4 border border-trait p-4 text-start">
      <label className="flex flex-col gap-2 text-sm">{t.motif}<select name="motif" required defaultValue="" className="min-h-11 border border-trait bg-blanc px-2"><option value="" disabled>{t.choisir}</option><option value="contrefacon">{t.contrefacon}</option><option value="contenu_inapproprie">{t.contenuInapproprie}</option><option value="arnaque">{t.arnaque}</option><option value="autre">{t.autre}</option></select></label>
      <label className="flex flex-col gap-2 text-sm">{t.commentaire}<textarea name="commentaire" maxLength={1000} rows={3} className="w-full border border-trait p-2" /></label>
      <button disabled={enCours} className="etiquette min-h-12 bg-noir px-2 text-blanc disabled:opacity-40">{enCours ? t.envoi : t.envoyer}</button>
    </form>}
    <p role="status" className="mt-3 text-sm">{message}</p>
  </section>;
}
