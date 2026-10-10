"use client";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { commanderPanier } from "@/app/panier/actions";
import FormulaireProfilClient from "./FormulaireProfilClient";
import CodeTelephone from "./CodeTelephone";
import BonPanier from "./BonPanier";
import ChoixParrain from "./ChoixParrain";
import { bonApplicable, bonPourTotal, type BonClient } from "@/lib/bons";
import { formaterPrix } from "@/lib/prix";
import { abonnerPanier, changerQuantitePanier, lignesCommande, lirePanier, NOTE_COMMANDE_MAX, panierBrut, QUANTITE_LIGNE_MAX, retirerDuPanier, sauverPanierLocal, totalPanier } from "@/lib/panier";
import { messageNoShows } from "@/lib/clients";
import { remplir } from "@/lib/langue";
import { afficherTaille } from "@/lib/article";
import { traduire } from "@/lib/textes";
import { useLangue, useTextes } from "./FournisseurTextes";
import { traduireMessage } from "@/lib/textes/messages";
import CaseConditions from "./CaseConditions";
import { formaterVersion } from "@/lib/juridique";
import type { DocumentAAccepter } from "@/lib/acceptations";

// US-21.2 : verificationRequise = mode téléphone (CONNEXION_CLIENT=telephone) ; telephoneVerifie = numéro vérifié par code.
export type ProfilPanier = { nom: string | null; telephone: string | null; complet: boolean; bloque: boolean; noShows: number; telephoneVerifie?: boolean; verificationRequise?: boolean } | null;
/** US-27 : bon disponible et saisie du parrain (avant la première commande), lus par la page. */
// US-33.2 : bons = bons du client (mes_bons) ; le panier propose le plus gros utilisable. Sans liste : bon parrainage.
export type ParrainagePanier = { bonDisponible: boolean; bons?: BonClient[]; choix: { initial: string; parrainSaisi: boolean; saisies: number } | null };

// US-20.2 : panier d’une boutique → « Commander ».
// US-34.2 : conditions = textes à (re)accepter (nouvelle version importante, compte créé avant US-34) : case et
// « Accepter et commander » à la place de « Commander ».
export default function PanierCommande({ profil, parrainage = { bonDisponible: false, choix: null }, conditions = [] }: { profil: ProfilPanier; parrainage?: ParrainagePanier; conditions?: DocumentAAccepter[] }) {
  const router = useRouter();
  const t = useTextes().panier;
  const tailleUnique = useTextes().listes.tailleUnique;
  const langue = useLangue();
  const brut = useSyncExternalStore(abonnerPanier, panierBrut, () => "");
  const panier = useMemo(() => lirePanier(brut), [brut]);
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [avecBon, setAvecBon] = useState(true);
  const [accord, setAccord] = useState(false);
  const tJuridique = useTextes().juridique;
  const verrou = useRef(false);

  if (!panier) return <div className="px-6 py-10 text-center"><p>{t.vide}</p><Link href="/catalogue" className="etiquette mt-6 flex min-h-[54px] items-center justify-center bg-noir text-blanc">{t.voirArticles}</Link></div>;

  async function commander() {
    if (verrou.current || !panier) return;
    if (note.trim().length > NOTE_COMMANDE_MAX) { setErreur(remplir(t.noteTropLongue, { max: NOTE_COMMANDE_MAX })); return; }
    verrou.current = true; setEnCours(true); setErreur("");
    try {
      const propose = parrainage.bons ? bonPourTotal(parrainage.bons, totalPanier(panier)) : null;
      const bon = Boolean(profil && parrainage.bonDisponible && avecBon && (propose ? propose.applicable : bonApplicable(totalPanier(panier), true)));
      const resultat = await commanderPanier(panier.boutiqueId, lignesCommande(panier), note, bon, accord ? conditions : []);
      if (resultat.id) { sauverPanierLocal(null); router.push(`/compte/commandes/${resultat.id}${resultat.bon ? `?bon=${resultat.bon}` : ""}`); return; }
      if (resultat.connexion) { router.push("/compte/connexion?suite=/panier"); return; }
      if (resultat.conditions) { setAccord(false); router.refresh(); }
      setErreur(resultat.erreur ?? t.envoiImpossible);
    } catch { setErreur(t.connexionPerdue); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const aAccepter = conditions.length > 0;
  const dateConditions = aAccepter ? formaterVersion(conditions.map(d => d.version).sort().at(-1)!) : "";
  const avertissement = profil ? traduireMessage(messageNoShows(profil.noShows, profil.bloque), langue) : null;
  return <div className="px-6">
    <p className="etiquette pb-2 text-center text-gris">{panier.boutiqueNom}</p>
    <ul aria-label={t.articles}>{panier.lignes.map(ligne => <li key={`${ligne.articleId}|${ligne.taille}`} className="flex items-center gap-3 border-b border-trait py-3">
      <Link href={`/a/${ligne.articleId}`} className="shrink-0">{ligne.photo ? <Image src={ligne.photo} alt={ligne.titre} width={64} height={80} className="h-20 w-16 object-cover" unoptimized /> : <span className="flex h-20 w-16 items-center justify-center bg-fond-photo text-xs text-gris">{t.photo}</span>}</Link>
      <div className="min-w-0 flex-1">
        <p dir="auto" className="break-words text-sm font-light">{ligne.titre}</p>
        <p className="text-xs text-gris">{remplir(ligne.beaute ? t.contenanceEtPrix : t.tailleEtPrix, { taille: traduire({ Unique: tailleUnique }, afficherTaille(ligne.taille, langue)), prix: formaterPrix(ligne.prix, langue) })}</p>
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
    {profil && parrainage.bonDisponible && (() => {
      const propose = parrainage.bons ? bonPourTotal(parrainage.bons, totalPanier(panier)) : null;
      return <BonPanier total={totalPanier(panier)} utiliser={avecBon} onChange={setAvecBon} desactive={enCours} bon={propose?.bon ?? null} applicable={propose?.applicable} />;
    })()}
    {avertissement && <p role="alert" className="mb-4 border border-trait p-3 text-sm leading-[1.6]">{avertissement}</p>}
    {profil && parrainage.choix && <div className="mb-4"><ChoixParrain initial={parrainage.choix.initial} parrainSaisi={parrainage.choix.parrainSaisi} saisies={parrainage.choix.saisies} /></div>}
    {!profil ? <Link href="/compte/connexion?suite=/panier" className="etiquette flex min-h-[54px] items-center justify-center bg-noir text-blanc">{t.seConnecter}</Link>
      : profil.verificationRequise && !profil.telephoneVerifie ? <div className="border border-noir p-4"><p className="etiquette mb-2 text-xs">{t.verifierTitre}</p><p className="mb-3 text-sm leading-[1.6]">{t.verifierTexte}</p><CodeTelephone usage="verification" numeroInitial={profil.telephone} onVerifie={() => router.refresh()} /></div>
      : !profil.complet ? <div className="border border-trait p-4"><p className="mb-3 text-sm">{profil.telephoneVerifie ? t.profilNom : t.profilNomTelephone}</p><FormulaireProfilClient nom={profil.nom} telephone={profil.telephone} telephoneModifiable={!profil.telephoneVerifie && !profil.verificationRequise} bouton={t.enregistrerContinuer} onEnregistre={() => router.refresh()} /></div>
      : aAccepter ? <div className="flex flex-col gap-3 border border-noir p-4">
        <p className="etiquette m-0 text-xs">{remplir(tJuridique.conditionsChangees, { date: dateConditions })}</p>
        <CaseConditions coche={accord} onChange={setAccord} desactive={enCours} />
        <button type="button" disabled={enCours || profil.bloque || !accord} onClick={() => void commander()} className="etiquette min-h-[54px] w-full bg-noir text-blanc disabled:opacity-50">{enCours ? t.envoi : tJuridique.accepterCommander}</button>
      </div>
      : <button type="button" disabled={enCours || profil.bloque} onClick={() => void commander()} className="etiquette min-h-[54px] w-full bg-noir text-blanc">{enCours ? t.envoi : t.commander}</button>}
    {erreur && <p role="alert" className="mt-3 text-sm">{erreur}</p>}
    <p className="mt-3 pb-8 text-center text-xs text-gris">{t.mention}</p>
  </div>;
}
