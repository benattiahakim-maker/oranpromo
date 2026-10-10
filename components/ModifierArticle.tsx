"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { filtrerTailles, couleurDepuisIA } from "@/lib/article";
import { supprimerArticle, type ArticleGere } from "@/lib/gestion-articles";
import { modifierArticleNavigateur } from "@/lib/envoi-article";
import { creerClientNavigateur } from "@/lib/supabase/client";
import FormulaireArticle from "./FormulaireArticle";
import PromoArticle from "./PromoArticle";
import { useLangue, useTextes } from "./FournisseurTextes";
import { traduireMessage } from "@/lib/textes/messages";

const bouton = "min-h-11 border border-noir px-3 py-2 text-sm disabled:opacity-50";
export default function ModifierArticle({ article }: { article: ArticleGere }) {
  const router = useRouter(), verrou = useRef(false);
  const textes = useTextes(), t = textes.espace.modifier, langue = useLangue();
  const [prixEnregistre, setPrixEnregistre] = useState(article.prix), [enCours, setEnCours] = useState(false), [confirmation, setConfirmation] = useState(false), [erreur, setErreur] = useState("");
  async function supprimer() {
    if (!confirmation || verrou.current) return;
    verrou.current = true; setEnCours(true); setErreur("");
    try { await supprimerArticle(creerClientNavigateur(), article.id); try { localStorage.removeItem(`oranpromo:article:modifier:${article.boutique_id}:${article.id}`); } catch { /* Stockage indisponible. */ } router.replace("/espace"); router.refresh(); }
    catch (error) { setErreur(error instanceof Error ? traduireMessage(error.message, langue) : t.suppressionImpossible); verrou.current = false; setEnCours(false); }
  }
  const photos = [...article.photos].sort((a, b) => a.ordre - b.ordre).map(p => ({ cle: p.id, adresse: p.adresse }));
  return <main className="mx-auto w-full max-w-[390px] bg-blanc p-6 text-noir"><Link href="/espace" className="etiquette inline-flex min-h-11 items-center">{textes.espace.commun.retourMesArticles}</Link><h1 className="my-6 font-titre text-[28px]">{t.titre}</h1>
    <FormulaireArticle initial={{ titre: article.titre, categorie: article.categorie, genre: article.genre, couleur: couleurDepuisIA(article.couleur ?? ""), description: article.description ?? "", descriptionAr: article.description_ar ?? "", prix: String(article.prix), tailles: filtrerTailles(article.tailles.filter(t => t.disponible).map(t => t.libelle), article.categorie, article.genre) }} photosInitiales={photos} cleBrouillon={`oranpromo:article:modifier:${article.boutique_id}:${article.id}`} ajout={false} occupe={enCours} onOccupation={setEnCours} onEnregistrer={async (saisie, choisies) => {
      const tailles = saisie.tailles.map(libelle => ({ libelle, disponible: true }));
      const photosModifiees = choisies.map(p => p.cle).join(",") !== photos.map(p => p.cle).join(",");
      let sauvegardees;
      if (photosModifiees) sauvegardees = await modifierArticleNavigateur(article.id, saisie, tailles, { garder: choisies.filter(p => !p.fichier).map(p => p.cle), fichiers: choisies.flatMap(p => p.fichier ? [p.fichier] : []) });
      else await modifierArticleNavigateur(article.id, saisie, tailles);
      setPrixEnregistre(Number(saisie.prix)); router.refresh();
      return sauvegardees?.sort((a, b) => a.ordre - b.ordre).map(p => ({ cle: p.id, adresse: p.adresse }));
    }} />
    {erreur && <p role="alert" className="mt-4 text-erreur">{erreur}</p>}
    <PromoArticle key={prixEnregistre} articleId={article.id} prixNormal={prixEnregistre} promo={article.promos} occupe={enCours} onOccupation={setEnCours} />
    <section className="mt-8 border-t border-trait pt-6" aria-label={t.suppression}>{confirmation ? <><p>{t.confirmer}</p><div className="mt-3 flex flex-col gap-3"><button disabled={enCours} type="button" className={`${bouton} bg-noir text-blanc`} onClick={() => void supprimer()}>{t.oui}</button><button disabled={enCours} type="button" className={bouton} onClick={() => setConfirmation(false)}>{textes.espace.commun.annuler}</button></div></> : <button disabled={enCours} type="button" className={`${bouton} w-full`} onClick={() => setConfirmation(true)}>{t.supprimer}</button>}</section>
  </main>;
}
