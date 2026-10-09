"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES_ARTICLE, GENRES_ARTICLE, normaliserTailles, TAILLES_ARTICLE, TAILLE_UNIQUE, validerArticle, type ErreursArticle } from "@/lib/article";
import { modifierArticle, supprimerArticle, type ArticleGere, type TailleModifiee } from "@/lib/gestion-articles";
import { creerClientNavigateur } from "@/lib/supabase/client";
import styles from "./espace-articles.module.css";
import PromoArticle from "./PromoArticle";
import DescriptionArabe from "./DescriptionArabe";

const champ = "mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base text-noir";
const bouton = "min-h-[44px] border border-noir px-3 py-2 text-sm disabled:opacity-50";

export default function ModifierArticle({ article }: { article: ArticleGere }) {
  const router = useRouter();
  const [titre, setTitre] = useState(article.titre);
  const [categorie, setCategorie] = useState(article.categorie);
  const [genre, setGenre] = useState<string>(article.genre);
  const [couleur, setCouleur] = useState(article.couleur ?? "");
  const [description, setDescription] = useState(article.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(article.description_ar ?? "");
  const [prix, setPrix] = useState(String(article.prix));
  const [prixEnregistre, setPrixEnregistre] = useState(article.prix);
  const [tailles, setTailles] = useState<TailleModifiee[]>(article.tailles.map(t => ({ libelle: t.libelle, disponible: t.disponible })));
  const [pointures, setPointures] = useState("");
  const [erreurs, setErreurs] = useState<ErreursArticle>({});
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  function ajouterTaille(libelle: string) {
    setTailles(avant => avant.some(t => t.libelle === libelle) ? avant : [...avant, { libelle, disponible: true }]);
  }
  async function enregistrer(event: FormEvent) {
    event.preventDefault();
    if (verrou.current) return;
    const nouvelles = normaliserTailles(pointures.split(/[,;\s]+/)).filter(libelle => !tailles.some(t => t.libelle === libelle));
    const choisies = [...tailles, ...nouvelles.map(libelle => ({ libelle, disponible: true }))];
    const saisie = { titre, categorie, genre, couleur, description, descriptionAr, prix, tailles: choisies.map(t => t.libelle), photos: [] };
    const validation = validerArticle(saisie, { verifierPhotos: false });
    setErreurs(validation); setErreur(""); setMessage("");
    if (Object.keys(validation).length) return;
    verrou.current = true; setEnCours(true);
    try { await modifierArticle(creerClientNavigateur(), article.id, saisie, choisies); setPrixEnregistre(Number(prix)); setTailles(choisies); setPointures(""); setMessage("Article enregistré."); router.refresh(); }
    catch (error) { setErreur(error instanceof Error ? error.message : "Impossible d’enregistrer l’article. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  async function supprimer() {
    if (!confirmation || verrou.current) return;
    verrou.current = true; setEnCours(true); setErreur(""); setMessage("");
    try { await supprimerArticle(creerClientNavigateur(), article.id); router.replace("/espace"); router.refresh(); }
    catch (error) { setErreur(error instanceof Error ? error.message : "Impossible de supprimer l’article. Réessayez."); verrou.current = false; setEnCours(false); }
  }
  const erreurChamp = (nom: keyof ErreursArticle) => erreurs[nom] ? <span id={`erreur-${nom}`} role="alert" className="mt-2 block text-sm normal-case tracking-normal">{erreurs[nom]}</span> : null;
  return <main className={`${styles.espace} mx-auto max-w-[390px] bg-blanc p-6 text-noir`}>
    <Link href="/espace" className="etiquette inline-flex min-h-[44px] items-center">← Mes articles</Link><h1 className="my-6 font-titre text-[28px] font-normal">Modifier l’article</h1>
    <form onSubmit={event => void enregistrer(event)} noValidate><fieldset disabled={enCours} className="flex min-w-0 flex-col gap-5">
      <label className="etiquette">Titre<input name="titre" className={champ} value={titre} onChange={e => setTitre(e.target.value)} aria-invalid={Boolean(erreurs.titre)} aria-describedby="erreur-titre" />{erreurChamp("titre")}</label>
      <label className="etiquette">Catégorie<select name="categorie" className={champ} value={categorie} onChange={e => setCategorie(e.target.value)} aria-invalid={Boolean(erreurs.categorie)} aria-describedby="erreur-categorie"><option value="">Choisir</option>{CATEGORIES_ARTICLE.map(c => <option key={c}>{c}</option>)}</select>{erreurChamp("categorie")}</label>
      <label className="etiquette">Genre<select name="genre" className={champ} value={genre} onChange={e => setGenre(e.target.value)} aria-invalid={Boolean(erreurs.genre)} aria-describedby="erreur-genre">{GENRES_ARTICLE.map(g => <option key={g} value={g}>{g}</option>)}</select>{erreurChamp("genre")}</label>
      <label className="etiquette">Couleur (facultative)<input name="couleur" className={champ} value={couleur} onChange={e => setCouleur(e.target.value)} /></label>
      <label className="etiquette">Description (facultative)<textarea name="description" className={champ} rows={4} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <DescriptionArabe titre={titre} description={description} valeur={descriptionAr} onChange={setDescriptionAr} occupe={enCours} />{erreurChamp("descriptionAr")}
      <label className="etiquette">Prix en DA<input name="prix" inputMode="numeric" className={champ} value={prix} onChange={e => setPrix(e.target.value)} aria-invalid={Boolean(erreurs.prix)} aria-describedby="erreur-prix" />{erreurChamp("prix")}</label>
      <fieldset className="min-w-0"><legend className="etiquette">Tailles</legend><p className="my-2 text-sm text-gris">Décochez une taille vendue pour la retirer de la vente.</p>
        {tailles.map((t, i) => <label key={t.libelle} className="flex min-h-[44px] items-center gap-3"><input type="checkbox" checked={t.disponible} onChange={e => setTailles(avant => avant.map((taille, index) => index === i ? { ...taille, disponible: e.target.checked } : taille))} />{t.libelle === TAILLE_UNIQUE ? "Taille unique" : t.libelle} disponible</label>)}
        <div className="my-3 grid grid-cols-3 gap-2">{[...TAILLES_ARTICLE, TAILLE_UNIQUE].filter(t => !tailles.some(taille => taille.libelle === t)).map(t => <button key={t} type="button" className={bouton} onClick={() => ajouterTaille(t)}>{t === TAILLE_UNIQUE ? "Taille unique" : t}</button>)}</div>
        <label className="etiquette">Pointures ou autres tailles<input name="pointures" className={champ} value={pointures} onChange={e => setPointures(e.target.value)} placeholder="Ex. : 38, 40, 42" aria-describedby="erreur-tailles" /></label>{erreurChamp("tailles")}
      </fieldset>
      <button type="submit" className={`${bouton} etiquette bg-noir text-blanc`}>{enCours ? "Enregistrement…" : "Enregistrer"}</button>
    </fieldset></form>
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
    <PromoArticle key={prixEnregistre} articleId={article.id} prixNormal={prixEnregistre} promo={article.promos} occupe={enCours} onOccupation={setEnCours} />
    <section className="mt-8 border-t border-trait pt-6" aria-label="Suppression de l’article">{confirmation ? <><p>Supprimer définitivement cet article et ses photos ?</p><div className="mt-3 flex flex-col gap-3"><button disabled={enCours} type="button" className={`${bouton} bg-noir text-blanc`} onClick={() => void supprimer()}>Oui, supprimer l’article</button><button disabled={enCours} type="button" className={bouton} onClick={() => setConfirmation(false)}>Annuler</button></div></> : <button disabled={enCours} type="button" className={`${bouton} w-full`} onClick={() => { setConfirmation(true); setMessage(""); }}>Supprimer l’article</button>}</section>
  </main>;
}
