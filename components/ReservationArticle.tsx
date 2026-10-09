"use client";

import { useState, useSyncExternalStore } from "react";
import { lienReservation } from "@/lib/whatsapp";
import { creerClientNavigateur } from "@/lib/supabase/client";

type Props = { articleId: string; boutiqueId: string; titre: string; prix: number; telephone: string; tailles: { libelle: string; disponible: boolean }[] };

export default function ReservationArticle({ articleId, boutiqueId, titre, prix, telephone, tailles }: Props) {
  const disponibles = tailles.filter(taille => taille.disponible);
  const unique = disponibles.length === 1 && /^(unique|taille unique|tu)$/i.test(disponibles[0].libelle.trim());
  const [taille, setTaille] = useState<string | null>(null);
  const origine = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const selection = unique ? disponibles[0].libelle : taille;
  const lien = selection && origine ? lienReservation({ telephoneBoutique: telephone, titre, taille: unique ? null : selection, prix, lien: `${origine}/a/${articleId}` }) : null;

  function enregistrerClic() {
    // L’enregistrement ne doit pas bloquer l’ouverture de WhatsApp.
    void creerClientNavigateur().from("evenements").insert({ type: "clic_reserver", article_id: articleId, boutique_id: boutiqueId, taille: selection }).then(({ error }) => {
      if (error) console.error("Le clic de réservation n’a pas pu être enregistré.");
    });
  }

  return <div className="px-6 py-6 text-center">
    <fieldset className="border-none p-0">
      <legend className="etiquette mx-auto mb-3">Taille</legend>
      <div className="grid grid-cols-4 border-t border-l border-trait">{tailles.map(t => <button type="button" key={t.libelle} disabled={!t.disponible} aria-label={`Taille ${t.libelle}${t.disponible ? "" : ", épuisée"}`} aria-pressed={selection === t.libelle} onClick={() => setTaille(t.libelle)} className={`h-12 border-r border-b border-trait text-sm ${!t.disponible ? "text-gris line-through" : selection === t.libelle ? "bg-noir text-blanc" : "bg-blanc"}`}>{t.libelle}</button>)}</div>
    </fieldset>
    {!selection && <p className="mt-3 text-sm text-gris">{disponibles.length ? "Choisissez une taille pour réserver." : "Aucune taille disponible."}</p>}
    {lien ? <a href={lien} target="_blank" rel="noopener noreferrer" onClick={enregistrerClic} className="etiquette mt-6 flex min-h-14 items-center justify-center bg-noir px-2 text-blanc">Réserver sur WhatsApp</a> : <button disabled className="etiquette mt-6 min-h-14 w-full bg-noir px-2 text-blanc opacity-40">Réserver sur WhatsApp</button>}
    <p className="mt-3 text-xs text-gris">La boutique confirme la disponibilité sur WhatsApp. Paiement en boutique.</p>
  </div>;
}
