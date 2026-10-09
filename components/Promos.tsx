"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { chargerPromos, type CarteArticle as Article } from "@/lib/catalogue";
import CarteArticle from "./CarteArticle";

export default function Promos({ initiales }: { initiales: Article[] }) {
  const [articles, setArticles] = useState(initiales);
  const [page, setPage] = useState(1);
  const [suite, setSuite] = useState(initiales.length === 20);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const enCours = useRef(false);
  const sentinelle = useRef<HTMLDivElement>(null);
  const charger = useCallback(async () => {
    if (!suite || enCours.current) return;
    enCours.current = true; setChargement(true); setErreur("");
    try {
      const nouveaux = await chargerPromos(creerClientNavigateur(), page);
      setArticles(liste => [...liste, ...nouveaux.filter(a => !liste.some(b => b.id === a.id))]);
      setSuite(nouveaux.length === 20); setPage(p => p + 1);
    } catch { setErreur("Impossible de charger la suite. Réessayez."); }
    finally { enCours.current = false; setChargement(false); }
  }, [page, suite]);
  useEffect(() => {
    if (!sentinelle.current || !suite || erreur) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void charger(); }, { rootMargin: "200px" });
    observer.observe(sentinelle.current); return () => observer.disconnect();
  }, [charger, suite, erreur]);
  return <>
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-5">{articles.map(article => <CarteArticle key={article.id} article={article} />)}</div>
    {!articles.length && <p className="px-6 py-12 text-center text-gris">Aucune promo en cours. Revenez bientôt découvrir les nouveautés.</p>}
    <div ref={sentinelle} className="p-6 text-center" aria-live="polite">
      {chargement && <p>Chargement…</p>}{erreur && <p className="mb-3">{erreur}</p>}
      {suite && <button onClick={() => void charger()} disabled={chargement} className="border border-noir px-6 py-3">{erreur ? "Réessayer" : "Voir plus de promos"}</button>}
    </div>
  </>;
}
