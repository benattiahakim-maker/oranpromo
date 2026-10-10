"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";
import type { ErreurAbonnement } from "@/lib/abonnements";
import { nePlusSuivre, seConnecterPourSuivre, suivreApresConnexion, suivreBoutique } from "@/app/compte/boutiques/actions";

type Props = {
  boutiqueId: string;
  slug: string;
  nom: string;
  /** Client connecté (null : visiteur ; les comptes commerçant et admin ne voient pas le bouton). */
  connecte: boolean;
  suivieAuDepart: boolean;
  /** Le visiteur a touché « Suivre » avant de se connecter : on termine le suivi au retour sur la vitrine. */
  terminerApresConnexion: boolean;
};

// US-31.2 : bouton « Suivre » / « ✓ Suivie » de la vitrine, avec confirmation avant d'arrêter de suivre.
export default function BoutonSuivre({ boutiqueId, slug, nom, connecte, suivieAuDepart, terminerApresConnexion }: Props) {
  const t = useTextes().suivre;
  const router = useRouter();
  const [suivie, setSuivie] = useState(suivieAuDepart);
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<ErreurAbonnement | null>(null);
  const [enCours, demarrer] = useTransition();
  const termine = useRef(false);

  useEffect(() => {
    if (!terminerApresConnexion || termine.current) return;
    termine.current = true;
    demarrer(async () => {
      const resultat = await suivreApresConnexion(slug);
      if (resultat.succes) { setSuivie(true); router.refresh(); } else if (resultat.erreur) setErreur(resultat.erreur);
    });
  }, [terminerApresConnexion, slug, router]);

  function agir(action: () => Promise<{ succes: boolean; suivie: boolean; erreur?: ErreurAbonnement }>) {
    setErreur(null);
    demarrer(async () => {
      const resultat = await action();
      if (resultat.succes) { setSuivie(resultat.suivie); setConfirmation(false); router.refresh(); } else setErreur(resultat.erreur ?? "erreur");
    });
  }

  const classe = "etiquette flex min-h-12 w-full items-center justify-center px-2 disabled:opacity-60";
  return <div className="mt-1">
    {!connecte ? <form action={seConnecterPourSuivre.bind(null, slug)}>
      <button type="submit" className={`${classe} border border-noir`}>{t.suivre}</button>
    </form> : confirmation ? <div role="group" aria-label={remplir(t.confirmer, { nom })} className="border border-noir p-4">
      <p dir="auto" className="text-sm">{remplir(t.confirmer, { nom })}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" disabled={enCours} onClick={() => agir(() => nePlusSuivre(boutiqueId))} className={`${classe} bg-noir text-blanc`}>{enCours ? t.enCours : t.nePlusSuivre}</button>
        <button type="button" disabled={enCours} onClick={() => setConfirmation(false)} className={`${classe} border border-noir`}>{t.garder}</button>
      </div>
    </div> : suivie ? <button type="button" aria-pressed="true" disabled={enCours} onClick={() => setConfirmation(true)} className={`${classe} border border-noir bg-fond-photo`}>{t.suivie}</button>
      : <button type="button" aria-pressed="false" disabled={enCours} onClick={() => agir(() => suivreBoutique(boutiqueId))} className={`${classe} border border-noir`}>{enCours ? t.enCours : t.suivre}</button>}
    {erreur && <p role="alert" className="mt-2 text-sm text-erreur">{t[erreur]}</p>}
  </div>;
}
