"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { ajouterAuPanier, chargerPanierLocal, ErreurAutreBoutique, ErreurPanier, QUANTITE_LIGNE_MAX, sauverPanierLocal } from "@/lib/panier";
import { lienQuestionArticle } from "@/lib/whatsapp";

// US-20.2 : la fiche ajoute l’article au panier d’une boutique (remplace « Réserver sur WhatsApp », US-07).
type Props = { articleId: string; boutique: { id: string; nom: string; whatsapp: string }; titre: string; prix: number; photo: string | null; tailles: { libelle: string; quantite: number }[] };

export default function CommandeArticle({ articleId, boutique, titre, prix, photo, tailles }: Props) {
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
      sauverPanierLocal(panier); setConflit(null); setMessage("Ajouté au panier.");
      // Le clic est compté comme une demande de réservation (statistiques US-08 / US-13), sans donnée personnelle.
      void creerClientNavigateur().from("evenements").insert({ type: "clic_reserver", article_id: articleId, boutique_id: boutique.id, taille: selection }).then(({ error }) => {
        if (error) console.error("Le clic de réservation n’a pas pu être enregistré.");
      });
    } catch (error) {
      if (error instanceof ErreurAutreBoutique) { setConflit(error.message); return; }
      setErreur(error instanceof ErreurPanier ? error.message : "Impossible d’ajouter l’article au panier.");
    }
  }

  return <div className="px-6 py-6 text-center">
    <fieldset className="border-none p-0">
      <legend className="etiquette mx-auto mb-3">Taille</legend>
      <div className="grid grid-cols-4 border-t border-l border-trait">{tailles.map(t => <button type="button" key={t.libelle} disabled={t.quantite <= 0} aria-label={`Taille ${t.libelle}${t.quantite > 0 ? "" : ", épuisée"}`} aria-pressed={selection === t.libelle} onClick={() => choisir(t.libelle)} className={`h-12 border-r border-b border-trait text-sm ${t.quantite <= 0 ? "text-gris line-through" : selection === t.libelle ? "bg-noir text-blanc" : "bg-blanc"}`}>{t.libelle}</button>)}</div>
    </fieldset>
    {!selection && <p className="mt-3 text-sm text-gris">{disponibles.length ? "Choisissez une taille pour commander." : "Aucune taille disponible."}</p>}
    {selection && <div className="mt-4 flex items-center justify-center gap-3">
      <span className="etiquette">Quantité</span>
      <div className="flex items-center border border-trait">
        <button type="button" aria-label="Une pièce de moins" disabled={quantite <= 1} onClick={() => setQuantite(q => Math.max(1, q - 1))} className="h-11 w-11 text-lg disabled:text-gris">−</button>
        <span aria-live="polite" aria-label={`Quantité : ${quantite}`} className="w-7 text-center text-sm">{quantite}</span>
        <button type="button" aria-label="Une pièce de plus" disabled={quantite >= maximum} onClick={() => setQuantite(q => Math.min(maximum, q + 1))} className="h-11 w-11 text-lg disabled:text-gris">+</button>
      </div>
    </div>}
    <button type="button" disabled={!selection} onClick={() => ajouter()} className="etiquette mt-6 min-h-14 w-full bg-noir px-2 text-blanc disabled:opacity-40">Ajouter au panier</button>
    {conflit && <div role="alert" className="mt-3 border border-trait p-3 text-sm leading-[1.6]"><p>{conflit}</p><button type="button" onClick={() => ajouter(true)} className="etiquette mt-2 min-h-11 border border-noir px-3">Vider le panier et ajouter</button></div>}
    {erreur && <p role="alert" className="mt-3 text-sm">{erreur}</p>}
    {message && <p role="status" className="mt-3 text-sm">{message} <Link href="/panier" className="underline">Voir le panier</Link></p>}
    <p className="mt-3 text-xs text-gris">La boutique confirme votre commande. Paiement en boutique.</p>
    {origine && <a href={lienQuestionArticle(boutique.whatsapp, titre, `${origine}/a/${articleId}`)} target="_blank" rel="noopener noreferrer" className="etiquette mt-2 inline-flex min-h-11 items-center text-gris underline">Une question ? WhatsApp</a>}
  </div>;
}
