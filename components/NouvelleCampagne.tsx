"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { creerCampagneAdmin } from "@/app/admin/bons/actions";
import { CAMPAGNE_PAR_DEFAUT, UNIVERS_CAMPAGNE, type SaisieCampagne } from "@/lib/bons-admin";

// US-33.5 : « Nouvelle campagne » (maquette ⑦). La campagne est active dès sa date de début.
const champ = "mt-1 min-h-11 w-full min-w-0 border border-trait px-3 text-sm text-noir";
const etiquette = "flex min-w-0 flex-1 flex-col text-xs text-gris";
export default function NouvelleCampagne({ villes }: { villes: { code: string; nom: string }[] }) {
  const router = useRouter();
  const vide: SaisieCampagne = { nom_fr: "", nom_ar: "", code: "", montant: String(CAMPAGNE_PAR_DEFAUT.montant), minimum: String(CAMPAGNE_PAR_DEFAUT.minimum),
    univers: "", villes: [], debut: "", fin: "", validite: String(CAMPAGNE_PAR_DEFAUT.validite), budget: "", plafond: String(CAMPAGNE_PAR_DEFAUT.plafond) };
  const [s, setS] = useState(vide);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const maj = (k: keyof SaisieCampagne) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS({ ...s, [k]: e.target.value });
  async function creer(e: React.FormEvent) {
    e.preventDefault();
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage(null);
    try { const r = await creerCampagneAdmin(s); setMessage({ ok: r.succes, texte: r.message }); if (r.succes) { setS(vide); router.refresh(); } }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <section aria-labelledby="nouvelle-campagne" className="mt-8 border-t border-trait pt-6">
    <h2 id="nouvelle-campagne" className="font-titre text-[24px] font-normal">Nouvelle campagne</h2>
    <form onSubmit={e => void creer(e)} className="mt-3 flex flex-col gap-3">
      <div className="flex gap-2"><label className={etiquette}>Nom (français)<input value={s.nom_fr} onChange={maj("nom_fr")} className={champ} /></label>
        <label className={etiquette}>Nom (arabe)<input dir="rtl" lang="ar" value={s.nom_ar} onChange={maj("nom_ar")} className={champ} /></label></div>
      <label className={etiquette}>Code<input value={s.code} onChange={e => setS({ ...s, code: e.target.value.toUpperCase() })} autoCapitalize="characters" className={champ} /></label>
      <div className="flex gap-2"><label className={etiquette}>Montant (DA)<input inputMode="numeric" value={s.montant} onChange={maj("montant")} className={champ} /></label>
        <label className={etiquette}>Minimum d’achat (DA)<input inputMode="numeric" value={s.minimum} onChange={maj("minimum")} className={champ} /></label></div>
      <label className={etiquette}>Univers<select value={s.univers} onChange={maj("univers")} className={`${champ} bg-blanc`}>{Object.entries(UNIVERS_CAMPAGNE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <fieldset className="text-xs text-gris"><legend>Villes (aucune cochée = toutes)</legend>
        <div className="mt-1 flex flex-wrap gap-x-4">{villes.map(v => <label key={v.code} className="inline-flex min-h-11 items-center gap-2 text-sm text-noir">
          <input type="checkbox" checked={s.villes.includes(v.code)} onChange={e => setS({ ...s, villes: e.target.checked ? [...s.villes, v.code] : s.villes.filter(x => x !== v.code) })} className="size-4 accent-noir" />{v.nom}</label>)}</div></fieldset>
      <div className="flex gap-2"><label className={etiquette}>Début<input type="date" value={s.debut} onChange={maj("debut")} className={champ} /></label>
        <label className={etiquette}>Fin (incluse)<input type="date" value={s.fin} onChange={maj("fin")} className={champ} /></label></div>
      <div className="flex gap-2"><label className={etiquette}>Validité du bon (jours)<input inputMode="numeric" value={s.validite} onChange={maj("validite")} className={champ} /></label>
        <label className={etiquette}>Plafond par boutique (bons)<input inputMode="numeric" value={s.plafond} onChange={maj("plafond")} className={champ} /></label></div>
      <label className={etiquette}>Budget (DA)<input inputMode="numeric" value={s.budget} onChange={maj("budget")} className={champ} /></label>
      <p className="text-xs leading-[1.6] text-gris">Une fois par numéro vérifié, remise par QR code obligatoire, un seul bon par commande. Le budget compte les bons donnés (pas seulement les utilisés).</p>
      <button type="submit" disabled={enCours} className="etiquette min-h-12 bg-noir text-blanc">Créer la campagne</button>
      {message && <p role={message.ok ? "status" : "alert"} className="border border-trait p-3 text-sm">{message.texte}</p>}
    </form>
  </section>;
}
