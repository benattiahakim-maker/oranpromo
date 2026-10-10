"use client";

import Isole from "@/components/Isole";
import { useRef, useState } from "react";
import Prix from "@/components/Prix";
import Image from "next/image";
import Link from "next/link";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { changerStatut, STATUTS_ARTICLE, type ArticleGere } from "@/lib/gestion-articles";
import { prixAffiche, promoActive } from "@/lib/prix";
import { ajusterQuantite, libelleStock, modifierStock, QUANTITE_STOCK_MAX, tailleEpuisee, type TailleStock } from "@/lib/stock";
import { normaliserTailles } from "@/lib/article";
import type { Enums } from "@/lib/supabase/types";
import { useLangue, useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";
import { traduireMessage } from "@/lib/textes/messages";

export default function MesArticles({ articles }: { articles: ArticleGere[] }) {
  const t = useTextes().espace.articles;
  return articles.length ? <ul>{articles.map(article => <LigneArticle key={article.id} article={article} />)}</ul> : <p className="py-6">{t.aucun}</p>;
}

function LigneArticle({ article }: { article: ArticleGere }) {
  const textes = useTextes(), t = textes.espace.articles, langue = useLangue();
  const [statut, setStatut] = useState(article.statut);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const verrou = useRef(false);
  const photo = [...article.photos].sort((a, b) => a.ordre - b.ordre)[0];
  const promo = article.promos ? { prixPromo: article.promos.prix_promo, dateFin: article.promos.date_fin } : null;
  async function changer(valeur: Enums<"statut_article">) {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setErreur("");
    try { await changerStatut(creerClientNavigateur(), article.id, valeur); setStatut(valeur); }
    catch (error) { setErreur(error instanceof Error ? traduireMessage(error.message, langue) : t.statutImpossible); }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <li className="border-b border-trait py-4">
    <div className="flex items-start gap-3">
      <Link href={`/espace/articles/${article.id}`} className="shrink-0" aria-label={remplir(t.modifier, { titre: article.titre })}>
        {photo ? <Image src={photo.adresse_vignette ?? photo.adresse} alt={article.titre} width={64} height={80} className="h-20 w-16 object-cover" unoptimized /> : <span className="flex h-20 w-16 items-center justify-center bg-fond-photo text-xs text-gris">{t.sansPhoto}</span>}
      </Link>
      <div className="min-w-0 flex-1"><Link href={`/espace/articles/${article.id}`} className="block break-words text-sm font-light"><Isole langue={langue}>{article.titre}</Isole></Link><p className="mt-1 text-sm"><Prix montant={prixAffiche(article.prix, promo)} langue={langue} /></p>
        {promoActive(promo) && <p className="etiquette mt-2 text-noir">{t.promo}</p>}
        <label className="mt-2 block text-xs">{remplir(t.statutDe, { titre: article.titre })}<select aria-label={remplir(t.statutDe, { titre: article.titre })} value={statut} disabled={enCours || article.masque_par_moderation} onChange={event => void changer(event.target.value as Enums<"statut_article">)} className="mt-1 min-h-[44px] w-full border border-trait bg-blanc px-2 text-noir">{Object.keys(STATUTS_ARTICLE).map(valeur => <option key={valeur} value={valeur}>{t.statuts[valeur as keyof typeof STATUTS_ARTICLE]}</option>)}</select></label>
        {article.masque_par_moderation && <p className="mt-2 text-xs text-gris">{t.masqueModeration}</p>}
      </div>
    </div>
    {article.tailles.length > 0 && <StockTailles articleId={article.id} titre={article.titre} tailles={article.tailles} onStatut={setStatut} />}
    {enCours && <p role="status" className="mt-2 text-sm">{textes.espace.commun.enregistrement}</p>}{erreur && <p role="alert" className="mt-2 text-sm">{erreur}</p>}
  </li>;
}

// US-20.1 : stock par taille modifiable en un appui (− / +), enregistré tout de suite.
function StockTailles({ articleId, titre, tailles, onStatut }: { articleId: string; titre: string; tailles: TailleStock[]; onStatut: (statut: Enums<"statut_article">) => void }) {
  const t = useTextes().espace.articles, langue = useLangue();
  const ordre = normaliserTailles(tailles.map(t => t.libelle));
  const [quantites, setQuantites] = useState(() => new Map(tailles.map(t => [t.id, t.quantite])));
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const verrou = useRef(false);
  const triees = [...tailles].sort((a, b) => ordre.indexOf(normaliserTailles([a.libelle])[0]) - ordre.indexOf(normaliserTailles([b.libelle])[0]));
  async function changer(taille: TailleStock, ecart: number) {
    if (verrou.current) return;
    const actuelle = quantites.get(taille.id) ?? 0, voulue = ajusterQuantite(actuelle, ecart);
    if (voulue === actuelle) return;
    verrou.current = true; setEnCours(taille.id); setErreur("");
    try {
      const resultat = await modifierStock(creerClientNavigateur(), articleId, taille.id, voulue);
      setQuantites(precedentes => new Map(precedentes).set(taille.id, resultat.quantite)); onStatut(resultat.statut);
    } catch (error) { setErreur(error instanceof Error ? traduireMessage(error.message, langue) : t.stockImpossible); }
    finally { verrou.current = false; setEnCours(null); }
  }
  return <div className="mt-3">
    <p className="etiquette text-gris">{t.stock}</p>
    <ul aria-label={remplir(t.stockDe, { titre })} className="mt-1 flex flex-wrap gap-1.5">{triees.map(taille => {
      const quantite = quantites.get(taille.id) ?? 0, epuisee = tailleEpuisee({ quantite });
      return <li key={taille.id} className={`flex items-center border border-trait text-xs ${epuisee ? "text-gris" : ""}`}>
        <span className={`min-w-6 px-1.5 ${epuisee ? "line-through" : ""}`}><Isole langue={langue}>{taille.libelle}</Isole></span>
        <button type="button" aria-label={remplir(t.moins, { taille: taille.libelle })} disabled={enCours !== null || quantite <= 0} onClick={() => void changer(taille, -1)} className="h-11 w-11 text-base">−</button>
        <span aria-live="polite" title={libelleStock(quantite, t)} className="w-6 text-center">{quantite}</span>
        <button type="button" aria-label={remplir(t.plus, { taille: taille.libelle })} disabled={enCours !== null || quantite >= QUANTITE_STOCK_MAX} onClick={() => void changer(taille, 1)} className="h-11 w-11 text-base">+</button>
      </li>;
    })}</ul>
    {erreur && <p role="alert" className="mt-2 text-sm">{erreur}</p>}
  </div>;
}
