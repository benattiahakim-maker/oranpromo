"use client";

import { useRef, useState, type FormEvent } from "react";
import Prix from "@/components/Prix";
import { useRouter } from "next/navigation";
import { arreterPromo, datePourChampPromo, enregistrerPromo, pourcentageDepuisPrix, prixDepuisPourcentage, validerPromo, type ErreursPromo, type SaisiePromo } from "@/lib/promo";
import { creerClientNavigateur } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

const champ = "mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base text-noir";
const bouton = "min-h-[44px] w-full border border-noir px-3 py-2 text-sm disabled:opacity-50";

export default function PromoArticle({ articleId, prixNormal, promo, occupe, onOccupation }: { articleId: string; prixNormal: number; promo: Tables<"promos"> | null; occupe: boolean; onOccupation: (occupe: boolean) => void }) {
  const router = useRouter();
  const [prixPromo, setPrixPromo] = useState(promo ? String(promo.prix_promo) : "");
  const [pourcentage, setPourcentage] = useState(promo ? String(pourcentageDepuisPrix(prixNormal, String(promo.prix_promo)) ?? "") : "");
  const [dateFin, setDateFin] = useState(promo ? datePourChampPromo(promo.date_fin) : "");
  const [badge, setBadge] = useState<SaisiePromo["badge"]>(promo?.badge === "Promo flash" ? "flash" : "reduction");
  const [presente, setPresente] = useState(Boolean(promo));
  const [erreurs, setErreurs] = useState<ErreursPromo>({});
  const [erreurPourcentage, setErreurPourcentage] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  function saisirPrix(valeur: string) {
    setPrixPromo(valeur); const calcul = pourcentageDepuisPrix(prixNormal, valeur); setPourcentage(calcul === null ? "" : String(calcul)); setErreurPourcentage("");
  }
  function saisirPourcentage(valeur: string) {
    setPourcentage(valeur); const calcul = prixDepuisPourcentage(prixNormal, valeur); setPrixPromo(calcul === null ? "" : String(calcul));
    setErreurPourcentage(valeur && calcul === null ? "Saisissez un pourcentage supérieur à 0 et inférieur à 100." : "");
  }
  async function agir(arret: boolean) {
    if (occupe || verrou.current) return;
    const saisie = { prixPromo, dateFin, badge };
    setErreur(""); setMessage("");
    if (!arret) { const validation = validerPromo(prixNormal, saisie); setErreurs(validation); if (Object.keys(validation).length || erreurPourcentage) return; }
    verrou.current = true; setEnCours(true); onOccupation(true);
    try {
      const client = creerClientNavigateur();
      if (arret) { await arreterPromo(client, articleId); setPresente(false); setPrixPromo(""); setPourcentage(""); setDateFin(""); setBadge("reduction"); setErreurs({}); setErreurPourcentage(""); setMessage("Promo arrêtée."); }
      else { await enregistrerPromo(client, articleId, saisie); setPresente(true); setMessage("Promo enregistrée."); }
      router.refresh();
    } catch (error) { setErreur(error instanceof Error ? error.message : "Impossible de modifier la promo. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); onOccupation(false); }
  }
  function enregistrer(event: FormEvent) { event.preventDefault(); void agir(false); }
  const erreurChamp = (nom: keyof ErreursPromo) => erreurs[nom] && <span role="alert" id={`erreur-promo-${nom}`} className="mt-2 block text-sm normal-case tracking-normal">{erreurs[nom]}</span>;
  const reduction = pourcentageDepuisPrix(prixNormal, prixPromo);
  return <section aria-labelledby="titre-promo" className="mt-8 border-t border-trait pt-6">
    <h2 id="titre-promo" className="font-titre text-base">Promo</h2><p className="my-3 text-sm text-gris">Prix normal enregistré : <Prix montant={prixNormal} /></p>
    <form onSubmit={enregistrer} noValidate><fieldset disabled={occupe || enCours} className="flex min-w-0 flex-col gap-5">
      <label className="etiquette">Prix promo en DA<input name="prixPromo" inputMode="numeric" value={prixPromo} onChange={e => saisirPrix(e.target.value)} className={champ} aria-invalid={Boolean(erreurs.prixPromo)} aria-describedby="erreur-promo-prixPromo" />{erreurChamp("prixPromo")}</label>
      <label className="etiquette">Réduction en pourcentage<input name="pourcentage" inputMode="decimal" value={pourcentage} onChange={e => saisirPourcentage(e.target.value)} className={champ} aria-invalid={Boolean(erreurPourcentage)} aria-describedby="erreur-promo-pourcentage" />{erreurPourcentage && <span role="alert" id="erreur-promo-pourcentage" className="mt-2 block text-sm normal-case tracking-normal">{erreurPourcentage}</span>}</label>
      <label className="etiquette">Date de fin<input name="dateFin" type="datetime-local" value={dateFin} onChange={e => setDateFin(e.target.value)} className={champ} aria-invalid={Boolean(erreurs.dateFin)} aria-describedby="erreur-promo-dateFin" />{erreurChamp("dateFin")}</label>
      <label className="etiquette">Badge<select name="badge" value={badge} onChange={e => setBadge(e.target.value as SaisiePromo["badge"])} className={champ}><option value="reduction">{reduction === null ? "−X %" : `−${reduction} %`} (par défaut)</option><option value="flash">Promo flash</option></select>{erreurChamp("badge")}</label>
      <button type="submit" className={`${bouton} etiquette bg-noir text-blanc`}>{enCours ? "Enregistrement…" : "Enregistrer la promo"}</button>
      {presente && <button type="button" className={bouton} onClick={() => void agir(true)}>Arrêter la promo</button>}
    </fieldset></form>
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
  </section>;
}
