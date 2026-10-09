"use client";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { commanderPanier } from "@/app/panier/actions";
import FormulaireProfilClient from "./FormulaireProfilClient";
import CodeTelephone from "./CodeTelephone";
import { formaterPrix } from "@/lib/prix";
import { abonnerPanier, changerQuantitePanier, lignesCommande, lirePanier, NOTE_COMMANDE_MAX, panierBrut, QUANTITE_LIGNE_MAX, retirerDuPanier, sauverPanierLocal, totalPanier } from "@/lib/panier";
import { messageNoShows } from "@/lib/clients";
import { remplir } from "@/lib/langue";
import { useLangue, useTextes } from "./FournisseurTextes";

// US-21.2 : verificationRequise = mode téléphone (CONNEXION_CLIENT=telephone) ; telephoneVerifie = numéro vérifié par code.
export type ProfilPanier = { nom: string | null; telephone: string | null; complet: boolean; bloque: boolean; noShows: number; telephoneVerifie?: boolean; verificationRequise?: boolean } | null;

// US-20.2 : panier d’une boutique → « Commander ».
export default function PanierCommande({ profil }: { profil: ProfilPanier }) {
  const router = useRouter();
  const t = useTextes().panier;
  const langue = useLangue();
  const brut = useSyncExternalStore(abonnerPanier, panierBrut, () => "");
  const panier = useMemo(() => lirePanier(brut), [brut]);
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);

  if (!panier) return <div className="px-6 py-10 text-center"><p>{t.vide}</p><Link href="/catalogue" className="etiquette mt-6 flex min-h-[54px] items-center justify-center bg-noir text-blanc">{t.voirArticles}</Link></div>;

  async function commander() {
    if (verrou.current || !panier) return;
    if (note.trim().length > NOTE_COMMANDE_MAX) { setErreur(remplir(t.noteTropLongue, { max: NOTE_COMMANDE_MAX })); return; }
    verrou.current = true; setEnCours(true); setErreur("");
    try {
      const resultat = await commanderPanier(panier.boutiqueId, lignesCommande(panier), note);
      if (resultat.id) { sauverPanierLocal(null); router.push(`/compte/commandes/${resultat.id}`); return; }
      if (resultat.connexion) { router.push("/compte/connexion?suite=/panier"); return; }
      setErreur(resultat.erreur ?? t.envoiImpossible);
    } catch { setErreur(t.connexionPerdue); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const avertissement = profil ? messageNoShows(profil.noShows, profil.bloque) : null;
  return <div className="px-6">
    <p className="etiquette pb-2 text-center text-gris">{panier.boutiqueNom}</p>
    <ul aria-label={t.articles}>{panier.lignes.map(ligne => <li key={`${ligne.articleId}|${ligne.taille}`} className="flex items-center gap-3 border-b border-trait py-3">
      <Link href={`/a/${ligne.articleId}`} className="shrink-0">{ligne.photo ? <Image src={ligne.photo} alt={ligne.titre} width={64} height={80} className="h-20 w-16 object-cover" unoptimized /> : <span className="flex h-20 w-16 items-center justify-center bg-fond-photo text-xs text-gris">{t.photo}</span>}</Link>
      <div className="min-w-0 flex-1">
        <p dir="auto" className="break-words text-sm font-light">{ligne.titre}</p>
        <p className="text-xs text-gris">{remplir(t.tailleEtPrix, { taille: ligne.taille, prix: formaterPrix(ligne.prix, langue) })}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center border border-trait">
            <button type="button" aria-label={remplir(t.moins, { titre: ligne.titre, taille: ligne.taille })} disabled={enCours || ligne.quantite <= 1} onClick={() => sauverPanierLocal(changerQuantitePanier(panier, ligne.articleId, ligne.taille, ligne.quantite - 1))} className="h-11 w-11 disabled:text-gris">−</button>
            <span className="w-6 text-center text-sm">{ligne.quantite}</span>
            <button type="button" aria-label={remplir(t.plus, { titre: ligne.titre, taille: ligne.taille })} disabled={enCours || ligne.quantite >= QUANTITE_LIGNE_MAX} onClick={() => sauverPanierLocal(changerQuantitePanier(panier, ligne.articleId, ligne.taille, ligne.quantite + 1))} className="h-11 w-11 disabled:text-gris">+</button>
          </div>
          <span className="text-sm">{formaterPrix(ligne.prix * ligne.quantite, langue)}</span>
        </div>
        <button type="button" disabled={enCours} onClick={() => sauverPanierLocal(retirerDuPanier(panier, ligne.articleId, ligne.taille))} className="mt-1 min-h-11 text-xs text-gris underline">{remplir(t.retirer, { titre: ligne.titre, taille: ligne.taille })}</button>
      </div>
    </li>)}</ul>
    <label htmlFor="note-commande" className="etiquette mt-4 block text-xs">{t.note}</label>
    <textarea id="note-commande" rows={2} maxLength={NOTE_COMMANDE_MAX} value={note} disabled={enCours} onChange={e => setNote(e.target.value)} className="mt-2 box-border w-full resize-none rounded-none border border-trait p-3 font-[inherit] text-base" />
    <p className="flex justify-between py-4"><span className="etiquette self-center">{t.total}</span><span>{formaterPrix(totalPanier(panier), langue)}</span></p>
    {avertissement && <p role="alert" className="mb-4 border border-trait p-3 text-sm leading-[1.6]">{avertissement}</p>}
    {!profil ? <Link href="/compte/connexion?suite=/panier" className="etiquette flex min-h-[54px] items-center justify-center bg-noir text-blanc">{t.seConnecter}</Link>
      : profil.verificationRequise && !profil.telephoneVerifie ? <div className="border border-noir p-4"><p className="etiquette mb-2 text-xs">{t.verifierTitre}</p><p className="mb-3 text-sm leading-[1.6]">{t.verifierTexte}</p><CodeTelephone usage="verification" numeroInitial={profil.telephone} onVerifie={() => router.refresh()} /></div>
      : !profil.complet ? <div className="border border-trait p-4"><p className="mb-3 text-sm">{profil.telephoneVerifie ? t.profilNom : t.profilNomTelephone}</p><FormulaireProfilClient nom={profil.nom} telephone={profil.telephone} telephoneModifiable={!profil.telephoneVerifie && !profil.verificationRequise} bouton={t.enregistrerContinuer} onEnregistre={() => router.refresh()} /></div>
      : <button type="button" disabled={enCours || profil.bloque} onClick={() => void commander()} className="etiquette min-h-[54px] w-full bg-noir text-blanc">{enCours ? t.envoi : t.commander}</button>}
    {erreur && <p role="alert" className="mt-3 text-sm">{erreur}</p>}
    <p className="mt-3 pb-8 text-center text-xs text-gris">{t.mention}</p>
  </div>;
}
