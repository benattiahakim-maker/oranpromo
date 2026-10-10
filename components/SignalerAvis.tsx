"use client";

// US-32.4 : lien « Signaler » / « بلّغ » sous chaque avis (maquette ④ et ⑩). Motifs : faux avis, insulte,
// informations personnelles, autre. Même limite par visiteur que le signalement d'un article (dans la base).
import { useId, useState } from "react";
import { envoyerSignalementAvis } from "@/app/visiteurs/actions";
import { remplir } from "@/lib/langue";
import type { Textes } from "@/lib/textes";

export const MOTIFS_AVIS = ["faux_avis", "insulte", "informations_personnelles", "autre"] as const;

export default function SignalerAvis({ avisId, auteur, t }: { avisId: string; auteur: string; t: Textes["avis"] }) {
  const id = useId();
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
    if (!(MOTIFS_AVIS as readonly string[]).includes(motif)) { setMessage(t.motifObligatoire); return; }
    setEnCours(true); setMessage("");
    try {
      const resultat = await envoyerSignalementAvis(avisId, motif, commentaire);
      if (resultat.succes) { setEnvoye(true); setOuvert(false); }
      setMessage(resultat.message);
    } catch { setMessage(t.signalementEchec); }
    finally { setEnCours(false); }
  }
  return <div className="mt-1">
    {!envoye && <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-controls={id} aria-label={remplir(t.signalerTitre, { auteur })} className="min-h-11 text-xs text-gris underline">{t.signaler}</button>}
    {ouvert && <form id={id} onSubmit={envoyer} className="mt-2 flex flex-col gap-3 border border-trait p-3 text-start">
      <label className="flex flex-col gap-2 text-sm">{t.motifSignalement}<select name="motif" required defaultValue="" className="min-h-11 border border-trait bg-blanc px-2"><option value="" disabled>{t.choisirMotif}</option>{MOTIFS_AVIS.map(m => <option key={m} value={m}>{t.motifs[m]}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm">{t.commentaireSignalement}<textarea name="commentaire" maxLength={1000} rows={2} className="w-full border border-trait p-2" /></label>
      <button disabled={enCours} className="etiquette min-h-11 bg-noir px-2 text-blanc disabled:opacity-40">{enCours ? t.envoiSignalement : t.envoyerSignalement}</button>
    </form>}
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </div>;
}
