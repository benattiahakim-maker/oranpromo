"use client";

import Link from "next/link";
import DescriptionArabe from "./DescriptionArabe";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES_ARTICLE, GENRES_ARTICLE, TAILLES_ARTICLE, TAILLE_UNIQUE, normaliserTailles, validerArticle, type ErreursArticle } from "@/lib/article";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { ErreurPublicationArticle, publierArticle } from "@/lib/publication-article";
import { compresserPhoto } from "@/lib/compression-photo";
import { champsVidesAPreRemplir, IA_INDISPONIBLE, type ChampIA, type FicheIA } from "@/lib/ia-fiche";

const champ = "box-border min-h-11 w-full rounded-none border-0 border-b border-noir bg-blanc px-0 py-2 font-[inherit] text-base text-noir";
const libelle = "flex flex-col gap-1.5 text-[11px] tracking-[1px] text-gris";
const bouton = "min-h-12 cursor-pointer rounded-none border border-noir bg-blanc px-3 py-2.5 font-[inherit] text-xs text-noir";

function ApercuPhoto({ fichier, index }: { fichier: File; index: number }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const adresse = URL.createObjectURL(fichier);
    if (image.current) image.current.src = adresse;
    return () => URL.revokeObjectURL(adresse);
  }, [fichier]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={`Photo ${index + 1}`} className="h-30 w-24 bg-fond-photo object-cover" />;
}

export default function NouvelArticle({ boutiqueId }: { boutiqueId: string }) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [titre, setTitre] = useState("");
  const [categorie, setCategorie] = useState("");
  const [genre, setGenre] = useState("");
  const [couleur, setCouleur] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [prix, setPrix] = useState("");
  const [tailles, setTailles] = useState<string[]>([]);
  const [pointures, setPointures] = useState("");
  const [erreurs, setErreurs] = useState<ErreursArticle>({});
  const [erreurEnvoi, setErreurEnvoi] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [lien, setLien] = useState("");
  const [copie, setCopie] = useState("");
  const verrou = useRef(false);
  const [preparationIA, setPreparationIA] = useState(false), [messageIA, setMessageIA] = useState("");
  const [champsIA, setChampsIA] = useState<ChampIA[]>([]);
  const saisieIA = useRef<FicheIA>({ titre: "", categorie: "", genre: "", couleur: "", description: "" });
  const requeteIA = useRef<AbortController | null>(null);
  useEffect(() => () => requeteIA.current?.abort(), []);

  function saisirChamp(nom: ChampIA, valeur: string) {
    saisieIA.current[nom] = valeur;
    ({ titre: setTitre, categorie: setCategorie, genre: setGenre, couleur: setCouleur, description: setDescription })[nom](valeur);
    if (!valeur.trim()) setChampsIA(avant => avant.filter(c => c !== nom));
  }
  async function preparerFiche(photo: File, controleur: AbortController) {
    setPreparationIA(true); setMessageIA("");
    try {
      const jpeg = await compresserPhoto(photo);
      if (controleur.signal.aborted) return;
      const formulaire = new FormData(); formulaire.append("photo", jpeg, "photo.jpg");
      const reponse = await fetch("/api/ia/fiche", { method: "POST", body: formulaire, signal: AbortSignal.any([controleur.signal, AbortSignal.timeout(18000)]) });
      const resultat = await reponse.json();
      if (controleur.signal.aborted) return;
      if (!reponse.ok || !resultat.fiche) { setMessageIA(resultat.message || IA_INDISPONIBLE); return; }
      const proposition = champsVidesAPreRemplir(saisieIA.current, resultat.fiche as FicheIA);
      const noms = Object.keys(proposition) as ChampIA[];
      for (const nom of noms) saisirChamp(nom, proposition[nom]!);
      setChampsIA(avant => [...new Set([...avant, ...noms])]);
    } catch { if (!controleur.signal.aborted) setMessageIA(IA_INDISPONIBLE); }
    finally { if (!controleur.signal.aborted) setPreparationIA(false); }
  }
  function changerPhotos(nouvelles: File[]) {
    if (nouvelles[0] !== fichiers[0]) {
      requeteIA.current?.abort(); setPreparationIA(false); setMessageIA("");
      if (nouvelles[0]) { const controleur = new AbortController(); requeteIA.current = controleur; void preparerFiche(nouvelles[0], controleur); }
    }
    setFichiers(nouvelles);
  }
  const repereIA = (nom: ChampIA) => champsIA.includes(nom) ? <span className="text-xs text-gris normal-case tracking-normal">Proposé par l’IA</span> : null;


  function ajouterPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const nouvelles = [...fichiers, ...Array.from(event.target.files ?? [])];
    event.target.value = "";
    if (nouvelles.length > 5) { setErreurs(avant => ({ ...avant, photos: "Vous pouvez ajouter au maximum 5 photos." })); return; }
    changerPhotos(nouvelles); setErreurs(avant => ({ ...avant, photos: undefined }));
  }

  function choisirTaille(taille: string) {
    if (taille === TAILLE_UNIQUE) { setTailles(tailles.includes(taille) ? [] : [taille]); setPointures(""); }
    else setTailles(avant => avant.includes(taille) ? avant.filter(t => t !== taille) : [...avant.filter(t => t !== TAILLE_UNIQUE), taille]);
  }

  async function publier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verrou.current) return;
    const saisie = { titre, categorie, genre, couleur, description, descriptionAr, prix, tailles: normaliserTailles([...tailles, ...pointures.split(/[,;\s]+/)]), photos: fichiers };
    const erreurs = validerArticle(saisie);
    setErreurs(erreurs); setErreurEnvoi("");
    if (Object.keys(erreurs).length) return;
    requeteIA.current?.abort(); setPreparationIA(false);
    verrou.current = true; setEnCours(true);
    try {
      const id = await publierArticle(creerClientNavigateur(), boutiqueId, saisie, fichiers, undefined, champsIA.length > 0);
      setArticleId(id); setLien(`${window.location.origin}/a/${id}`);
    } catch (error) { setErreurEnvoi(error instanceof ErreurPublicationArticle ? error.message : "Impossible de publier l’article. Vérifiez votre connexion et réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }

  function recommencer() {
    setDescriptionAr("");
    requeteIA.current?.abort(); setPreparationIA(false); setMessageIA(""); setChampsIA([]); saisieIA.current = { titre: "", categorie: "", genre: "", couleur: "", description: "" };
    setArticleId(null); setFichiers([]); setTitre(""); setCategorie(""); setGenre(""); setCouleur(""); setDescription(""); setPrix(""); setTailles([]); setPointures(""); setErreurs({}); setErreurEnvoi(""); setCopie(""); setLien("");
  }
  async function copierLien() {
    try { await navigator.clipboard.writeText(lien); setCopie("Lien copié."); }
    catch { setCopie("La copie automatique est indisponible. Sélectionnez le lien pour le copier."); }
  }
  const erreur = (nom: keyof ErreursArticle) => erreurs[nom] ? <p id={`erreur-${nom}`} role="alert" className="m-0 text-[13px] tracking-normal text-noir">{erreurs[nom]}</p> : null;

  if (articleId) return <main className="mx-auto box-border w-full max-w-[390px] p-6">
    <h1 className="font-titre text-[30px] font-normal">Article en ligne</h1>
    <Link href={`/a/${articleId}`} className="my-6 block wrap-anywhere text-noir">{lien}</Link>
    <div className="flex flex-col gap-3"><button type="button" onClick={() => void copierLien()} className={bouton}>Copier le lien</button><button type="button" onClick={recommencer} className={`${bouton} bg-noir! text-blanc!`}>Ajouter un autre article</button></div>
    <p role="status" className="text-sm">{copie}</p>
  </main>;

  return <div className="mx-auto w-full max-w-[390px] bg-blanc text-noir">
    <header className="grid grid-cols-[44px_1fr_44px] items-center border-b border-trait px-3 py-3.5"><span /><h1 className="m-0 text-center text-xs font-medium tracking-[2px]">NOUVEL ARTICLE</h1><Link href="/espace" aria-label="Fermer" className="flex h-11 w-11 items-center justify-center text-inherit no-underline">×</Link></header>
    <form noValidate onSubmit={publier} className="px-6 pt-5 pb-6">
      <fieldset disabled={enCours} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <section aria-label="Photos de l’article">
          <p className={`${libelle} mt-0`}>PHOTOS · 1 À 5 *</p>
          <div className="flex flex-wrap gap-2.5">{fichiers.map((fichier, index) => <div key={`${index}-${fichier.name}`} className="w-24">
            <ApercuPhoto fichier={fichier} index={index} />
            <button type="button" onClick={() => changerPhotos(fichiers.filter((_, position) => position !== index))} aria-label={`Retirer la photo ${index + 1}`} className={`${bouton} w-full border-0! text-[11px]!`}>Retirer</button>
          </div>)}</div>
          <div className="mt-3 flex flex-col gap-2.5">
            <label className={libelle}>Prendre une photo<input aria-label="Prendre une photo" type="file" accept="image/*" capture="environment" onChange={ajouterPhotos} disabled={enCours || fichiers.length >= 5} aria-describedby="erreur-photos" className="w-full text-xs tracking-normal" /></label>
            <label className={libelle}>Choisir dans la galerie<input aria-label="Choisir dans la galerie" type="file" accept="image/*" multiple onChange={ajouterPhotos} disabled={enCours || fichiers.length >= 5} aria-describedby="erreur-photos" className="w-full text-xs tracking-normal" /></label>
          </div>{erreur("photos")}
          <p className="mb-0 text-xs text-gris">Photos JPEG, PNG ou WebP.</p>
          {preparationIA && <p role="status" className="text-sm text-gris">L’IA prépare la fiche…</p>}
          {messageIA && <p role="status" className="text-sm text-gris">{messageIA}</p>}
        </section>
        <label className={libelle}>TITRE *<input name="titre" value={titre} onChange={event => saisirChamp("titre", event.target.value)} required aria-invalid={Boolean(erreurs.titre)} aria-describedby="erreur-titre" className={champ} />{repereIA("titre")}{erreur("titre")}</label>
        <div className="grid grid-cols-2 gap-3.5">
          <label className={libelle}>CATÉGORIE *<select name="categorie" value={categorie} onChange={event => saisirChamp("categorie", event.target.value)} required aria-invalid={Boolean(erreurs.categorie)} aria-describedby="erreur-categorie" className={champ}><option value="">Choisir</option>{CATEGORIES_ARTICLE.map(c => <option key={c} value={c}>{c}</option>)}</select>{repereIA("categorie")}{erreur("categorie")}</label>
          <label className={libelle}>GENRE<select name="genre" value={genre} onChange={event => saisirChamp("genre", event.target.value)} className={champ}><option value="">Choisir</option>{GENRES_ARTICLE.map(g => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}</select>{repereIA("genre")}{erreur("genre")}</label>
        </div>
        <label className={libelle}>COULEUR (FACULTATIF)<input name="couleur" value={couleur} onChange={event => saisirChamp("couleur", event.target.value)} className={champ} />{repereIA("couleur")}</label>
        <label className={libelle}>DESCRIPTION (FACULTATIVE)<textarea name="description" rows={3} value={description} onChange={event => saisirChamp("description", event.target.value)} className={`${champ} resize-y leading-normal`} />{repereIA("description")}</label>
        <DescriptionArabe titre={titre} description={description} valeur={descriptionAr} onChange={setDescriptionAr} occupe={enCours} />{erreur("descriptionAr")}
        <label className={`${libelle} text-noir!`}>PRIX EN DA *<input name="prix" type="text" inputMode="numeric" value={prix} onChange={event => setPrix(event.target.value)} required aria-invalid={Boolean(erreurs.prix)} aria-describedby="erreur-prix" placeholder="Votre prix" className={`${champ} border-b-2`} />{erreur("prix")}</label>
        <fieldset className="m-0 min-w-0 border-0 p-0"><legend className={`${libelle} mb-2.5 text-noir!`}>TAILLES DISPONIBLES *</legend>
          <div className="grid grid-cols-3">{[...TAILLES_ARTICLE, TAILLE_UNIQUE].map(t => <button key={t} type="button" aria-pressed={tailles.includes(t)} onClick={() => choisirTaille(t)} className={`${bouton} border-trait! ${tailles.includes(t) ? "bg-noir! text-blanc!" : "bg-blanc text-noir"}`}>{t === TAILLE_UNIQUE ? "Taille unique" : t}</button>)}</div>
          <label className={`${libelle} mt-3.5`}>POINTURES OU AUTRES TAILLES<input name="pointures" value={pointures} onChange={event => { setPointures(event.target.value); if (event.target.value.trim()) setTailles(avant => avant.filter(t => t !== TAILLE_UNIQUE)); }} placeholder="Ex. : 38, 40, 42" aria-describedby="erreur-tailles" className={champ} /></label>{erreur("tailles")}
        </fieldset>
        {erreurEnvoi && <p role="alert" className="m-0 border border-trait p-3 text-sm leading-[1.6]">{erreurEnvoi}</p>}
        <button type="submit" className={`${bouton} min-h-[54px]! w-full bg-noir! tracking-[2px] text-blanc! disabled:opacity-50`}>{enCours ? "PUBLICATION EN COURS…" : "PUBLIER L’ARTICLE"}</button>
      </fieldset>
    </form>
  </div>;
}
