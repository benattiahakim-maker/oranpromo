"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { remplir } from "@/lib/langue";
import { formaterPrix } from "@/lib/prix";
import { ajouterCode } from "@/app/compte/bons/actions";
import { useLangue, useTextes } from "./FournisseurTextes";

// US-33.3 : « J'ai un code » (texte n° 3) → « Ajouter » (n° 4) → bon ajouté (n° 5) ou la raison (n° 6 à 8).
export default function AjouterCodeBon() {
  const t = useTextes().parrainage;
  const langue = useLangue();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ texte: string; ok: boolean } | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function envoyer() {
    if (enCours || !code.trim()) return;
    setEnCours(true); setMessage(null);
    try {
      const r = await ajouterCode(code);
      if (r.etat === "ajoute" && "montant" in r) {
        setMessage({ ok: true, texte: remplir(t.codeAjoute, { nom: (langue === "ar" ? r.nom_ar : r.nom_fr) ?? "", montant: formaterPrix(r.montant ?? 0, langue), minimum: formaterPrix(r.minimum_achat ?? 0, langue) }) });
        setCode(""); router.refresh();
      } else {
        const textes = { inconnu: t.codeInconnu, deja: t.codeDeja, trop: t.codeTrop, numero: t.codeNumero, ajoute: t.codeInconnu, erreur: t.codeErreur };
        setMessage({ ok: false, texte: textes[r.etat] });
      }
    } catch { setMessage({ ok: false, texte: t.codeErreur }); }
    finally { setEnCours(false); }
  }

  return <section className="mt-6">
    {!ouvert ? <button type="button" onClick={() => setOuvert(true)} className="min-h-11 text-sm underline">{t.jaiUnCode}</button>
      : <form onSubmit={e => { e.preventDefault(); void envoyer(); }} className="flex gap-2">
        <input aria-label={t.jaiUnCode} value={code} onChange={e => setCode(e.target.value)} maxLength={24} autoCapitalize="characters" autoComplete="off" dir="ltr"
          className="min-h-12 min-w-0 flex-1 rounded-none border border-noir px-3 text-base uppercase" />
        <button type="submit" disabled={enCours || !code.trim()} className="etiquette min-h-12 bg-noir px-5 text-blanc disabled:opacity-50">{t.ajouterCode}</button>
      </form>}
    {message && <p role={message.ok ? "status" : "alert"} className="mt-2 text-sm leading-[1.6]">{message.texte}</p>}
  </section>;
}
