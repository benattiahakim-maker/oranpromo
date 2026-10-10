"use client";
import { useState, useTransition } from "react";
import { useTextes } from "@/components/FournisseurTextes";
import type { ErreurAlertes } from "@/lib/alertes-whatsapp";
import { activerAlertes, desactiverAlertes } from "@/app/compte/boutiques/actions";

// US-31.5 : bloc « Alertes WhatsApp » de /compte/boutiques (maquette SuivreBoutique, écran ④). Activer : le texte de
// l'accord est affiché juste au-dessus du bouton ; désactiver est toujours possible, même si les alertes ne sont plus proposées.
export default function AlertesCompte({ activesAuDepart, proposees }: { activesAuDepart: boolean; proposees: boolean }) {
  const t = useTextes().alertes;
  const [actives, setActives] = useState(activesAuDepart);
  const [erreur, setErreur] = useState<ErreurAlertes | null>(null);
  const [enCours, demarrer] = useTransition();

  function agir(action: () => Promise<{ succes: boolean; actives: boolean; erreur?: ErreurAlertes }>) {
    setErreur(null);
    demarrer(async () => {
      const resultat = await action();
      if (resultat.succes) setActives(resultat.actives); else setErreur(resultat.erreur ?? "erreur");
    });
  }

  const bouton = "etiquette mt-3 flex min-h-12 w-full items-center justify-center border border-noir px-2 disabled:opacity-60";
  return <section aria-label={t.titre} className="mt-6 border border-trait p-4">
    <h2 className="etiquette">{t.titre}</h2>
    <p role="status" className="mt-1 text-sm">{actives ? t.etatActives : t.etatDesactivees}</p>
    {actives ? <button type="button" disabled={enCours} onClick={() => agir(desactiverAlertes)} className={bouton}>{enCours ? t.enCours : t.desactiver}</button>
      : proposees && <>
        <p className="mt-3 text-xs leading-[1.5] text-gris">{t.caseAccord}</p>
        <button type="button" disabled={enCours} onClick={() => agir(() => activerAlertes("compte"))} className={bouton}>{enCours ? t.enCours : t.activer}</button>
      </>}
    {erreur && <p role="alert" className="mt-2 text-sm text-erreur">{t[erreur]}</p>}
  </section>;
}
