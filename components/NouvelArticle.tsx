"use client";
import Link from "next/link";
import { useState } from "react";
import FormulaireArticle, { CHAMPS_ARTICLE_VIDES } from "./FormulaireArticle";
import { publierArticleNavigateur } from "@/lib/envoi-article";

export default function NouvelArticle({ boutiqueId }: { boutiqueId: string }) {
  const [articleId, setArticleId] = useState<string | null>(null), [lien, setLien] = useState(""), [copie, setCopie] = useState("");
  async function copier() { try { await navigator.clipboard.writeText(lien); setCopie("Lien copié."); } catch { setCopie("La copie automatique est indisponible. Sélectionnez le lien pour le copier."); } }
  if (articleId) return <main className="mx-auto w-full max-w-[390px] p-6"><h1 className="font-titre text-[30px]">Article en ligne</h1><Link href={`/a/${articleId}`} className="my-6 block wrap-anywhere">{lien}</Link><div className="flex flex-col gap-3"><button type="button" onClick={() => void copier()} className="min-h-12 border border-noir p-3">Copier le lien</button><button type="button" onClick={() => { setArticleId(null); setCopie(""); }} className="min-h-12 bg-noir p-3 text-blanc">Ajouter un autre article</button></div><p role="status">{copie}</p></main>;
  return <main className="mx-auto w-full max-w-[390px]"><header className="grid grid-cols-[44px_1fr_44px] items-center border-b border-trait px-3 py-3.5"><span /><h1 className="text-center text-xs tracking-[2px]">NOUVEL ARTICLE</h1><Link href="/espace" aria-label="Fermer" className="flex h-11 w-11 items-center justify-center">×</Link></header><div className="p-6"><FormulaireArticle initial={CHAMPS_ARTICLE_VIDES} cleBrouillon={`oranpromo:article:nouveau:${boutiqueId}`} ajout onEnregistrer={async (saisie, photos, ia) => { const fichiers = photos.flatMap(p => p.fichier ? [p.fichier] : []); const id = await publierArticleNavigateur(boutiqueId, saisie, fichiers, ia); setArticleId(id); setLien(`${window.location.origin}/a/${id}`); }} /></div></main>;
}
