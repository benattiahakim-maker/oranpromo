"use client";

import { useState } from "react";
import { enregistrerEvenement } from "@/lib/evenements";

export default function PartagerArticle({ titre, boutiqueId, articleId, libelle = "Partager" }: { titre: string; boutiqueId: string; articleId?: string; libelle?: string }) {
  const [message, setMessage] = useState("");
  async function partager() {
    void enregistrerEvenement("partage", boutiqueId, articleId);
    try {
      if (navigator.share) await navigator.share({ title: titre, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setMessage("Lien copié"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Impossible de partager le lien.");
    }
  }
  return <div className="absolute top-3 end-2"><button aria-label={libelle} onClick={partager} className="flex h-11 w-11 items-center justify-center bg-blanc">↑</button><p role="status" className="text-xs">{message}</p></div>;
}
