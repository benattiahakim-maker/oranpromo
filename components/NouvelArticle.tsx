"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CATEGORIES_ARTICLE, GENRES_ARTICLE, TAILLES_ARTICLE, TAILLE_UNIQUE, normaliserTailles, validerArticle, type ErreursArticle } from "@/lib/article";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { ErreurPublicationArticle, publierArticle } from "@/lib/publication-article";
import { compresserPhoto } from "@/lib/compression-photo";
import { champsVidesAPreRemplir, IA_INDISPONIBLE, type ChampIA, type FicheIA } from "@/lib/ia-fiche";

const champ: CSSProperties = { width: "100%", minHeight: 44, boxSizing: "border-box", border: 0, borderBottom: "1px solid #0A0A0A", borderRadius: 0, padding: "8px 0", background: "#FFFFFF", color: "#0A0A0A", font: "inherit", fontSize: 16 };
const libelle: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 11, letterSpacing: 1, color: "#6F6F6F" };
const bouton: CSSProperties = { minHeight: 48, border: "1px solid #0A0A0A", borderRadius: 0, padding: "10px 12px", background: "#FFFFFF", color: "#0A0A0A", font: "inherit", fontSize: 12, cursor: "pointer" };

function ApercuPhoto({ fichier, index }: { fichier: File; index: number }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const adresse = URL.createObjectURL(fichier);
    if (image.current) image.current.src = adresse;
    return () => URL.revokeObjectURL(adresse);
  }, [fichier]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={`Photo ${index + 1}`} style={{ width: 96, height: 120, objectFit: "cover", background: "#F3F2EF" }} />;
}

export default function NouvelArticle({ boutiqueId }: { boutiqueId: string }) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [titre, setTitre] = useState("");
  const [categorie, setCategorie] = useState("");
  const [genre, setGenre] = useState("");
  const [couleur, setCouleur] = useState("");
  const [description, setDescription] = useState("");
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
    const saisie = { titre, categorie, genre, couleur, description, prix, tailles: normaliserTailles([...tailles, ...pointures.split(/[,;\s]+/)]), photos: fichiers };
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
    requeteIA.current?.abort(); setPreparationIA(false); setMessageIA(""); setChampsIA([]); saisieIA.current = { titre: "", categorie: "", genre: "", couleur: "", description: "" };
    setArticleId(null); setFichiers([]); setTitre(""); setCategorie(""); setGenre(""); setCouleur(""); setDescription(""); setPrix(""); setTailles([]); setPointures(""); setErreurs({}); setErreurEnvoi(""); setCopie(""); setLien("");
  }
  async function copierLien() {
    try { await navigator.clipboard.writeText(lien); setCopie("Lien copié."); }
    catch { setCopie("La copie automatique est indisponible. Sélectionnez le lien pour le copier."); }
  }
  const erreur = (nom: keyof ErreursArticle) => erreurs[nom] ? <p id={`erreur-${nom}`} role="alert" style={{ margin: 0, fontSize: 13, letterSpacing: 0, color: "#0A0A0A" }}>{erreurs[nom]}</p> : null;

  if (articleId) return <main style={{ maxWidth: 390, width: "100%", margin: "0 auto", padding: 24, boxSizing: "border-box" }}>
    <h1 style={{ fontFamily: "var(--font-bodoni), serif", fontSize: 30, fontWeight: 400 }}>Article en ligne</h1>
    <Link href={`/a/${articleId}`} style={{ display: "block", margin: "24px 0", overflowWrap: "anywhere", color: "#0A0A0A" }}>{lien}</Link>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><button type="button" onClick={() => void copierLien()} style={bouton}>Copier le lien</button><button type="button" onClick={recommencer} style={{ ...bouton, background: "#0A0A0A", color: "#FFFFFF" }}>Ajouter un autre article</button></div>
    <p role="status" style={{ fontSize: 14 }}>{copie}</p>
  </main>;

  return <div style={{ maxWidth: 390, width: "100%", margin: "0 auto", background: "#FFFFFF", color: "#0A0A0A" }}>
    <header style={{ display: "grid", gridTemplateColumns: "44px 1fr 44px", alignItems: "center", padding: "14px 12px", borderBottom: "1px solid #E6E6E6" }}><span /><h1 style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: 2, textAlign: "center" }}>NOUVEL ARTICLE</h1><Link href="/espace" aria-label="Fermer" style={{ display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center", textDecoration: "none", color: "inherit" }}>×</Link></header>
    <form noValidate onSubmit={publier} style={{ padding: "20px 24px 24px" }}>
      <fieldset disabled={enCours} style={{ display: "flex", flexDirection: "column", gap: 20, border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <section aria-label="Photos de l’article">
          <p style={{ ...libelle, marginTop: 0 }}>PHOTOS · 1 À 5 *</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{fichiers.map((fichier, index) => <div key={`${index}-${fichier.name}`} style={{ width: 96 }}>
            <ApercuPhoto fichier={fichier} index={index} />
            <button type="button" onClick={() => changerPhotos(fichiers.filter((_, position) => position !== index))} aria-label={`Retirer la photo ${index + 1}`} style={{ ...bouton, width: "100%", border: 0, fontSize: 11 }}>Retirer</button>
          </div>)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <label style={libelle}>Prendre une photo<input aria-label="Prendre une photo" type="file" accept="image/*" capture="environment" onChange={ajouterPhotos} disabled={enCours || fichiers.length >= 5} aria-describedby="erreur-photos" style={{ fontSize: 12, letterSpacing: 0, width: "100%" }} /></label>
            <label style={libelle}>Choisir dans la galerie<input aria-label="Choisir dans la galerie" type="file" accept="image/*" multiple onChange={ajouterPhotos} disabled={enCours || fichiers.length >= 5} aria-describedby="erreur-photos" style={{ fontSize: 12, letterSpacing: 0, width: "100%" }} /></label>
          </div>{erreur("photos")}
          <p style={{ marginBottom: 0, fontSize: 12, color: "#6F6F6F" }}>Photos JPEG, PNG ou WebP.</p>
          {preparationIA && <p role="status" className="text-sm text-gris">L’IA prépare la fiche…</p>}
          {messageIA && <p role="status" className="text-sm text-gris">{messageIA}</p>}
        </section>
        <label style={libelle}>TITRE *<input name="titre" value={titre} onChange={event => saisirChamp("titre", event.target.value)} required aria-invalid={Boolean(erreurs.titre)} aria-describedby="erreur-titre" style={champ} />{repereIA("titre")}{erreur("titre")}</label>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 14 }}>
          <label style={libelle}>CATÉGORIE *<select name="categorie" value={categorie} onChange={event => saisirChamp("categorie", event.target.value)} required aria-invalid={Boolean(erreurs.categorie)} aria-describedby="erreur-categorie" style={champ}><option value="">Choisir</option>{CATEGORIES_ARTICLE.map(c => <option key={c} value={c}>{c}</option>)}</select>{repereIA("categorie")}{erreur("categorie")}</label>
          <label style={libelle}>GENRE<select name="genre" value={genre} onChange={event => saisirChamp("genre", event.target.value)} style={champ}><option value="">Choisir</option>{GENRES_ARTICLE.map(g => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}</select>{repereIA("genre")}{erreur("genre")}</label>
        </div>
        <label style={libelle}>COULEUR (FACULTATIF)<input name="couleur" value={couleur} onChange={event => saisirChamp("couleur", event.target.value)} style={champ} />{repereIA("couleur")}</label>
        <label style={libelle}>DESCRIPTION (FACULTATIVE)<textarea name="description" rows={3} value={description} onChange={event => saisirChamp("description", event.target.value)} style={{ ...champ, resize: "vertical", lineHeight: 1.5 }} />{repereIA("description")}</label>
        <label style={{ ...libelle, color: "#0A0A0A" }}>PRIX EN DA *<input name="prix" type="text" inputMode="numeric" value={prix} onChange={event => setPrix(event.target.value)} required aria-invalid={Boolean(erreurs.prix)} aria-describedby="erreur-prix" placeholder="Votre prix" style={{ ...champ, borderBottomWidth: 2 }} />{erreur("prix")}</label>
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><legend style={{ ...libelle, marginBottom: 10, color: "#0A0A0A" }}>TAILLES DISPONIBLES *</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>{[...TAILLES_ARTICLE, TAILLE_UNIQUE].map(t => <button key={t} type="button" aria-pressed={tailles.includes(t)} onClick={() => choisirTaille(t)} style={{ ...bouton, borderColor: "#E6E6E6", background: tailles.includes(t) ? "#0A0A0A" : "#FFFFFF", color: tailles.includes(t) ? "#FFFFFF" : "#0A0A0A" }}>{t === TAILLE_UNIQUE ? "Taille unique" : t}</button>)}</div>
          <label style={{ ...libelle, marginTop: 14 }}>POINTURES OU AUTRES TAILLES<input name="pointures" value={pointures} onChange={event => { setPointures(event.target.value); if (event.target.value.trim()) setTailles(avant => avant.filter(t => t !== TAILLE_UNIQUE)); }} placeholder="Ex. : 38, 40, 42" aria-describedby="erreur-tailles" style={champ} /></label>{erreur("tailles")}
        </fieldset>
        {erreurEnvoi && <p role="alert" style={{ margin: 0, padding: 12, border: "1px solid #E6E6E6", fontSize: 14, lineHeight: 1.6 }}>{erreurEnvoi}</p>}
        <button type="submit" style={{ ...bouton, width: "100%", minHeight: 54, background: "#0A0A0A", color: "#FFFFFF", letterSpacing: 2, opacity: enCours ? 0.5 : 1 }}>{enCours ? "PUBLICATION EN COURS…" : "PUBLIER L’ARTICLE"}</button>
      </fieldset>
    </form>
  </div>;
}
