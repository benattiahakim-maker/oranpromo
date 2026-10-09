"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { enregistrerEvenement } from "@/lib/evenements";
import { ajouterAuPanier, chargerPanierLocal, ErreurAutreBoutique, ErreurPanier, QUANTITE_LIGNE_MAX, sauverPanierLocal } from "@/lib/panier";
import { lienQuestionArticle } from "@/lib/whatsapp";
import { remplir } from "@/lib/langue";
import { traduire } from "@/lib/textes";
import { useLangue, useTextes } from "./FournisseurTextes";
import { traduireMessage } from "@/lib/textes/messages";

// US-20.2 : la fiche ajoute l’article au panier d’une boutique (remplace « Réserver sur WhatsApp », US-07).
type Props = { articleId: string; boutique: { id: string; nom: string; whatsapp: string }; titre: string; prix: number; photo: string | null; tailles: { libelle: string; quantite: number }[] };

export default function CommandeArticle({ articleId, boutique, titre, prix, photo, tailles }: Props) {
  const t = useTextes().fiche;
  const langue = useLangue();
  const tailleUnique = useTextes().listes.tailleUnique;
  const disponibles = tailles.filter(t => t.quantite > 0);
  const unique = tailles.length === 1 && disponibles.length === 1 && /^(unique|taille unique|tu)$/i.test(disponibles[0].libelle.trim());
  const [taille, setTaille] = useState<string | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [conflit, setConflit] = useState<string | null>(null);
  const origine = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const selection = unique ? disponibles[0].libelle : taille;
  const stock = tailles.find(t => t.libelle === selection)?.quantite ?? 0;
  const maximum = Math.max(1, Math.min(QUANTITE_LIGNE_MAX, stock));

  function choisir(libelle: string) { setTaille(libelle); setQuantite(1); setMessage(""); setErreur(""); setConflit(null); }

  function ajouter(remplacer = false) {
    if (!selection) return;
    setMessage(""); setErreur("");
    try {
      const panier = ajouterAuPanier(chargerPanierLocal(), { id: boutique.id, nom: boutique.nom }, { articleId, titre, taille: selection, quantite, prix, photo }, stock, remplacer);
      sauverPanierLocal(panier); setConflit(null); setMessage(t.ajoute);
      // Le clic est compté comme une demande de réservation (statistiques US-08 / US-13), sans donnée personnelle.
      void enregistrerEvenement("clic_reserver", boutique.id, articleId, selection);
    } catch (error) {
      if (error instanceof ErreurAutreBoutique) { setConflit(traduireMessage(error.message, langue)); return; }
      setErreur(error instanceof ErreurPanier ? traduireMessage(error.message, langue) : t.ajoutImpossible);
    }
  }

  return <div className="px-6 py-6 text-center">
    <fieldset className="border-none p-0">
      <legend className="etiquette mx-auto mb-3">{t.taille}</legend>
      <div className="grid grid-cols-4 border-t border-s border-trait">{tailles.map(x => { const libelle = traduire({ Unique: tailleUnique }, x.libelle); return <button type="button" key={x.libelle} disabled={x.quantite <= 0} aria-label={remplir(x.quantite > 0 ? t.tailleN : t.tailleEpuisee, { taille: libelle })} aria-pressed={selection === x.libelle} onClick={() => choisir(x.libelle)} className={`h-12 border-e border-b border-trait text-sm ${x.quantite <= 0 ? "text-gris line-through" : selection === x.libelle ? "bg-noir text-blanc" : "bg-blanc"}`}>{libelle}</button>; })}</div>
    </fieldset>
    {!selection && <p className="mt-3 text-sm text-gris">{disponibles.length ? t.choisirTaille : t.aucuneTaille}</p>}
    {selection && <div className="mt-4 flex items-center justify-center gap-3">
      <span className="etiquette">{t.quantite}</span>
      <div className="flex items-center border border-trait">
        <button type="button" aria-label={t.moins} disabled={quantite <= 1} onClick={() => setQuantite(q => Math.max(1, q - 1))} className="h-11 w-11 text-lg disabled:text-gris">−</button>
        <span aria-live="polite" aria-label={remplir(t.quantiteN, { n: quantite })} className="w-7 text-center text-sm">{quantite}</span>
        <button type="button" aria-label={t.plus} disabled={quantite >= maximum} onClick={() => setQuantite(q => Math.min(maximum, q + 1))} className="h-11 w-11 text-lg disabled:text-gris">+</button>
      </div>
    </div>}
    <button type="button" disabled={!selection} onClick={() => ajouter()} className="etiquette mt-6 min-h-14 w-full bg-noir px-2 text-blanc disabled:opacity-40">{t.ajouter}</button>
    {conflit && <div role="alert" className="mt-3 border border-trait p-3 text-sm leading-[1.6]"><p>{conflit}</p><button type="button" onClick={() => ajouter(true)} className="etiquette mt-2 min-h-11 border border-noir px-3">{t.viderEtAjouter}</button></div>}
    {erreur && <p role="alert" className="mt-3 text-sm">{erreur}</p>}
    {message && <p role="status" className="mt-3 text-sm">{message} <Link href="/panier" className="underline">{t.voirPanier}</Link></p>}
    <p className="mt-3 text-xs text-gris">{t.confirmation}</p>
    {origine && <a href={lienQuestionArticle(boutique.whatsapp, titre, `${origine}/a/${articleId}`)} target="_blank" rel="noopener noreferrer" className="etiquette mt-2 inline-flex min-h-11 items-center text-gris underline">{t.question}</a>}
  </div>;
}
