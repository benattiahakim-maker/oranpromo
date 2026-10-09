"use client";

import { useState } from "react";
import { enregistrerEvenement } from "@/lib/evenements";
import { useTextes } from "./FournisseurTextes";

export default function PartagerArticle({ titre, boutiqueId, articleId, libelle }: { titre: string; boutiqueId: string; articleId?: string; libelle?: string }) {
  const t = useTextes().fiche;
  const [message, setMessage] = useState("");
  async function partager() {
    void enregistrerEvenement("partage", boutiqueId, articleId);
    try {
      if (navigator.share) await navigator.share({ title: titre, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setMessage(t.lienCopie); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(t.partageImpossible);
    }
  }
  return <div className="absolute top-3 end-2"><button aria-label={libelle ?? t.partager} onClick={partager} className="flex h-11 w-11 items-center justify-center bg-blanc">↑</button><p role="status" className="text-xs">{message}</p></div>;
}
