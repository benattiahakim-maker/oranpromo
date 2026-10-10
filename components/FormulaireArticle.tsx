"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATEGORIES_BEAUTE, CATEGORIES_MODE, GENRES_ARTICLE, estCategorieBeaute, filtrerTailles, validerArticle, type SaisieArticle, type ErreursArticle } from "@/lib/article";
import { lireBrouillonArticle, serialiserBrouillonArticle, type ChampsBrouillon } from "@/lib/brouillon-article";
import { champsVidesAPreRemplir, IA_INDISPONIBLE, type ChampIA, type FicheIA } from "@/lib/ia-fiche";
import { compresserPhoto } from "@/lib/compression-photo";
import PhotosArticle, { type PhotoChoisie } from "./PhotosArticle";
import { ChoixCouleur, ChoixTailles } from "./ChoixArticle";
import DescriptionArabe from "./DescriptionArabe";
import { useLangue, useTextes } from "./FournisseurTextes";
import { traduire } from "@/lib/textes";
import { traduireMessage } from "@/lib/textes/messages";

export const CHAMPS_ARTICLE_VIDES: ChampsBrouillon = { titre: "", categorie: "", genre: "", couleur: "", description: "", descriptionAr: "", prix: "", tailles: [] };
export default function FormulaireArticle({ initial, photosInitiales = [], cleBrouillon, ajout, onEnregistrer, onOccupation, occupe = false }: { initial: ChampsBrouillon; photosInitiales?: PhotoChoisie[]; cleBrouillon: string; ajout: boolean; onEnregistrer: (saisie: SaisieArticle, photos: PhotoChoisie[], proposeParIA: boolean) => Promise<PhotoChoisie[] | void>; onOccupation?: (v: boolean) => void; occupe?: boolean }) {
  const textes = useTextes(), t = textes.espace.formulaire, langue = useLangue();
  const [champs, setChamps] = useState(initial), actuel = useRef(initial);
  const [photos, setPhotos] = useState(photosInitiales);
  const [restaure, setRestaure] = useState(false), [pret, setPret] = useState(false);
  const [valideUneFois, setValideUneFois] = useState(false), [erreurPhoto, setErreurPhoto] = useState("");
  const [message, setMessage] = useState(""), [erreurEnvoi, setErreurEnvoi] = useState("");
  const [enCours, setEnCours] = useState(false), verrou = useRef(false);
  const [champsIA, setChampsIA] = useState<ChampIA[]>([]), [preparationIA, setPreparationIA] = useState(false), [messageIA, setMessageIA] = useState("");
  const requeteIA = useRef<AbortController | null>(null), formulaire = useRef<HTMLFormElement>(null);
  const [referenceSerie, setReferenceSerie] = useState(() => serialiserBrouillonArticle(initial));
  const [referencePhotos, setReferencePhotos] = useState(() => photosInitiales.map(p => p.cle).join(","));
  const serie = serialiserBrouillonArticle({ ...champs, champsIA });
  const modifie = serie !== referenceSerie || photos.map(p => p.cle).join(",") !== referencePhotos;
  const saisie: SaisieArticle = { ...champs, photos: photos.map(p => p.fichier ?? { type: "image/jpeg", size: 1 }) };
  const erreurs: ErreursArticle = valideUneFois ? validerArticle(saisie, { verifierPhotos: ajout || photosInitiales.length > 0 || photos.length > 0 }) : {};
  if (erreurPhoto) erreurs.photos = erreurPhoto;
  useEffect(() => {
    let annule = false;
    queueMicrotask(() => {
      if (annule) return;
      try { const brouillon = lireBrouillonArticle(localStorage.getItem(cleBrouillon)); if (brouillon) { actuel.current = brouillon; setChamps(brouillon); setChampsIA(brouillon.champsIA ?? []); setRestaure(true); } } catch { /* Stockage indisponible : saisie manuelle conservée. */ }
      setPret(true);
    });
    return () => { annule = true; };
  }, [cleBrouillon]);
  useEffect(() => {
    if (!pret) return;
    try { if (modifie) localStorage.setItem(cleBrouillon, serie); else localStorage.removeItem(cleBrouillon); } catch { /* Aucun blocage si le stockage est plein. */ }
  }, [cleBrouillon, modifie, pret, serie]);
  useEffect(() => {
    if (!modifie) return;
    const quitter = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", quitter);
    return () => window.removeEventListener("beforeunload", quitter);
  }, [modifie]);
  useEffect(() => () => requeteIA.current?.abort(), []);
  function changer(nom: keyof ChampsBrouillon, valeur: string | string[]) {
    const suivant = { ...actuel.current, [nom]: valeur };
    if (nom === "categorie" || nom === "genre") {
      suivant.tailles = filtrerTailles(suivant.tailles, suivant.categorie, suivant.genre);
      if (suivant.tailles.length !== actuel.current.tailles.length) setMessage(t.taillesReinitialisees);
    }
    actuel.current = suivant; setChamps(suivant); setErreurEnvoi(""); setChampsIA(avant => avant.filter(c => c !== nom));
  }
  async function preparer(photo: File, controleur: AbortController) {
    setPreparationIA(true); setMessageIA("");
    try {
      const jpeg = await compresserPhoto(photo); if (controleur.signal.aborted) return;
      const corps = new FormData(); corps.append("photo", jpeg, "photo.jpg");
      const reponse = await fetch("/api/ia/fiche", { method: "POST", body: corps, signal: AbortSignal.any([controleur.signal, AbortSignal.timeout(18000)]) });
      const resultat = await reponse.json(); if (controleur.signal.aborted) return;
      if (!reponse.ok || !resultat.fiche) { setMessageIA(traduireMessage(resultat.message || IA_INDISPONIBLE, langue)); return; }
      const proposition = champsVidesAPreRemplir(actuel.current as FicheIA, resultat.fiche as FicheIA);
      const noms = Object.keys(proposition) as ChampIA[];
      for (const nom of noms) changer(nom, proposition[nom]!);
      setChampsIA(avant => [...new Set([...avant, ...noms])]);
    } catch { if (!controleur.signal.aborted) setMessageIA(traduireMessage(IA_INDISPONIBLE, langue)); }
    finally { if (!controleur.signal.aborted) setPreparationIA(false); }
  }
  function changerPhotos(nouvelles: PhotoChoisie[]) {
    if (ajout && nouvelles[0]?.cle !== photos[0]?.cle) {
      requeteIA.current?.abort(); setPreparationIA(false); setMessageIA("");
      if (nouvelles[0]?.fichier) { const controleur = new AbortController(); requeteIA.current = controleur; void preparer(nouvelles[0].fichier, controleur); }
    }
    setPhotos(nouvelles); setErreurPhoto("");
  }
  function effacer() {
    requeteIA.current?.abort(); setPreparationIA(false); setMessageIA(""); setChampsIA([]);
    actuel.current = initial; setChamps(initial); setPhotos(photosInitiales); setRestaure(false); setValideUneFois(false); setErreurPhoto(""); setMessage(""); setErreurEnvoi("");
    try { localStorage.removeItem(cleBrouillon); } catch { /* Stockage indisponible. */ }
  }
  function ciblerErreur(validation: ErreursArticle) {
    const ordre: (keyof ErreursArticle)[] = ["photos", "titre", "categorie", "genre", "couleur", "descriptionAr", "prix", "tailles"];
    const nom = ordre.find(n => validation[n]);
    const element = formulaire.current?.querySelector<HTMLElement>(`[name="${nom}"]`);
    element?.focus(); element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }
  async function enregistrer(event: FormEvent) {
    event.preventDefault(); if (verrou.current || occupe) return;
    const validation = validerArticle(saisie, { verifierPhotos: ajout || photosInitiales.length > 0 || photos.length > 0 });
    if (erreurPhoto) validation.photos = erreurPhoto;
    setValideUneFois(true); setErreurEnvoi("");
    if (Object.keys(validation).length) { ciblerErreur(validation); return; }
    verrou.current = true; setEnCours(true); onOccupation?.(true); requeteIA.current?.abort(); setPreparationIA(false);
    try {
      const sauvegardees = await onEnregistrer(saisie, photos, champsIA.length > 0);
      if (sauvegardees) setPhotos(sauvegardees);
      setReferenceSerie(serie); setReferencePhotos((sauvegardees ?? photos).map(p => p.cle).join(","));
      try { localStorage.removeItem(cleBrouillon); } catch { /* Succès conservé même sans stockage. */ }
      setRestaure(false); setMessage(t.enregistre);
    } catch (error) { setErreurEnvoi(error instanceof Error ? traduireMessage(error.message, langue) : t.enregistrementImpossible); }
    finally { verrou.current = false; setEnCours(false); onOccupation?.(false); }
  }
  const classeChamp = (nom?: keyof ErreursArticle) => `mt-2 min-h-11 w-full border bg-blanc px-3 py-2 text-base text-noir ${nom && erreurs[nom] ? "border-erreur" : "border-trait"}`;
  const erreurChamp = (nom: keyof ErreursArticle) => erreurs[nom] ? <span id={`erreur-${nom}`} role="alert" className="mt-2 block text-sm text-erreur normal-case tracking-normal">{traduireMessage(erreurs[nom]!, langue)}</span> : null;
  const repere = (nom: ChampIA) => champsIA.includes(nom) ? <span className="text-xs text-gris normal-case tracking-normal">{t.proposeIA}</span> : null;
  return <form ref={formulaire} noValidate onSubmit={event => void enregistrer(event)} className="min-w-0">
    {restaure && <div role="status" className="mb-5 border border-trait p-3 text-sm">{t.brouillonRestaure} · <button type="button" onClick={effacer} className="underline">{t.effacer}</button><p className="mt-1 text-gris">{t.brouillonPhotos}</p></div>}
    <fieldset disabled={enCours || occupe} className="flex min-w-0 flex-col gap-5 border-0 p-0">
      <PhotosArticle photos={photos} onChange={changerPhotos} erreur={erreurs.photos} onErreur={setErreurPhoto} />
      {preparationIA && <p role="status" className="text-sm text-gris">{t.iaPrepare}</p>}{messageIA && <p role="status" className="text-sm text-gris">{messageIA}</p>}
      <label className="etiquette">{ajout ? t.titreAjout : t.titre}<input name="titre" dir="auto" className={classeChamp("titre")} value={champs.titre} onChange={e => changer("titre", e.target.value)} aria-invalid={Boolean(erreurs.titre)} aria-describedby="erreur-titre" />{repere("titre")}{erreurChamp("titre")}</label>
      <label className="etiquette">{ajout ? t.categorieAjout : t.categorie}<select name="categorie" className={classeChamp("categorie")} value={champs.categorie} onChange={e => changer("categorie", e.target.value)} aria-invalid={Boolean(erreurs.categorie)} aria-describedby="erreur-categorie"><option value="">{t.choisir}</option><optgroup label={textes.listes.groupesCategories.mode}>{CATEGORIES_MODE.map(c => <option key={c} value={c}>{traduire(textes.listes.categories, c)}</option>)}</optgroup><optgroup label={textes.listes.groupesCategories.beaute}>{CATEGORIES_BEAUTE.map(c => <option key={c} value={c}>{traduire(textes.listes.categories, c)}</option>)}</optgroup></select>{repere("categorie")}{erreurChamp("categorie")}</label>
      <label className="etiquette">{estCategorieBeaute(champs.categorie) ? (ajout ? t.genreFacultatifAjout : t.genreFacultatif) : ajout ? t.genreAjout : t.genre}<select name="genre" className={classeChamp("genre")} value={champs.genre} onChange={e => changer("genre", e.target.value)} aria-invalid={Boolean(erreurs.genre)} aria-describedby="erreur-genre"><option value="">{estCategorieBeaute(champs.categorie) ? t.nonPrecise : t.choisir}</option>{GENRES_ARTICLE.map(g => <option key={g} value={g}>{langue === "fr" ? g : textes.listes.genres[g]}</option>)}</select>{repere("genre")}{erreurChamp("genre")}</label>
      <ChoixCouleur valeur={champs.couleur} onChange={v => changer("couleur", v)} erreur={erreurs.couleur} />{repere("couleur")}
      <label className="etiquette">{ajout ? t.descriptionAjout : t.description}<textarea name="description" rows={4} dir="auto" className={classeChamp()} value={champs.description} onChange={e => changer("description", e.target.value)} />{repere("description")}</label>
      <DescriptionArabe titre={champs.titre} description={champs.description} valeur={champs.descriptionAr} onChange={v => changer("descriptionAr", v)} occupe={enCours} erreur={erreurs.descriptionAr} />{erreurChamp("descriptionAr")}
      <label className="etiquette">{ajout ? t.prixAjout : t.prix}<input name="prix" inputMode="numeric" dir="ltr" className={classeChamp("prix")} value={champs.prix} onChange={e => changer("prix", e.target.value)} aria-invalid={Boolean(erreurs.prix)} aria-describedby="erreur-prix" />{erreurChamp("prix")}</label>
      <ChoixTailles categorie={champs.categorie} genre={champs.genre} valeurs={champs.tailles} onChange={v => changer("tailles", v)} erreur={erreurs.tailles} />
      {message && <p role="status" className="text-sm">{message}</p>}{erreurEnvoi && <p role="alert" className="border border-erreur p-3 text-sm text-erreur">{erreurEnvoi}</p>}
      <button type="submit" className="etiquette min-h-[54px] w-full border border-noir bg-noir px-3 py-2 text-blanc disabled:opacity-50">{enCours ? textes.espace.commun.enregistrement : ajout ? t.publier : t.enregistrer}</button>
    </fieldset>
  </form>;
}
