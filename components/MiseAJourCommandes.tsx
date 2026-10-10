"use client";
// US-28.4 : mise à jour automatique de /espace/commandes (option A, décision 2) et signal d’une nouvelle commande.
// Toutes les 20 s, seulement quand la page est visible, GET /espace/commandes/etat (compteurs + dernier numéro).
// Si quelque chose a changé : router.refresh() (nouveau rendu serveur, l’état de la page — recherche, cases, détail — est gardé).
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";
import { DUREE_NOUVEAU_MS, empreinteEtat, heureOran, INTERVALLE_ERREUR_MS, INTERVALLE_MS, type EtatCommandes } from "@/lib/tableau-commandes";

export const URL_ETAT = "/espace/commandes/etat";
const CLE_SON = "oranpromo-son";

// --- Son : choix gardé dans le navigateur (décision 3 : « Activer le son » seulement) ----------------
const ecouteurs = new Set<() => void>();
function abonnerSon(f: () => void) { ecouteurs.add(f); window.addEventListener("storage", f); return () => { ecouteurs.delete(f); window.removeEventListener("storage", f); }; }
function lireSon() { try { return window.localStorage.getItem(CLE_SON) === "1"; } catch { return false; } }
function ecrireSon(actif: boolean) { try { window.localStorage.setItem(CLE_SON, actif ? "1" : "0"); } catch { /* stockage refusé : le choix vaut pour cette page */ } ecouteurs.forEach(f => f()); }

let contexteAudio: AudioContext | null = null;
/** Deux bips courts générés par le navigateur (Web Audio), aucun fichier. */
export function bip() {
  try {
    const Classe = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Classe) return;
    contexteAudio ??= new Classe();
    const ctx = contexteAudio;
    void ctx.resume?.();
    for (const debut of [0, 0.2]) {
      const oscillateur = ctx.createOscillator(), volume = ctx.createGain();
      oscillateur.frequency.value = 880; volume.gain.value = 0.15;
      oscillateur.connect(volume); volume.connect(ctx.destination);
      oscillateur.start(ctx.currentTime + debut); oscillateur.stop(ctx.currentTime + debut + 0.12);
    }
  } catch { /* pas de son possible : le bandeau suffit */ }
}

type Nouvelle = { numero: number; nombre: number };
type Valeur = { aJour: number; erreur: boolean; son: boolean; nouvelle: Nouvelle | null; numeroAuChargement: number; actualiser: () => void; activerSon: () => void; couperSon: () => void; fermer: () => void };
const Contexte = createContext<Valeur | null>(null);

export default function MiseAJourCommandes({ initial, maintenant, children }: { initial: EtatCommandes; maintenant: number; children: ReactNode }) {
  const router = useRouter();
  const son = useSyncExternalStore(abonnerSon, lireSon, () => false);
  const [aJour, setAJour] = useState(maintenant);
  const [erreur, setErreur] = useState(false);
  const [nouvelle, setNouvelle] = useState<Nouvelle | null>(null);
  const [numeroAuChargement] = useState(initial.derniere ?? 0);
  const empreinte = useRef(empreinteEtat(initial));
  const precedent = useRef(initial);
  const sonActif = useRef(son);
  const enCours = useRef(false);
  const nombreNouvelles = useRef(0);
  const titreBase = useRef<string | null>(null);
  useEffect(() => { sonActif.current = son; }, [son]);
  // Routeur gardé dans une référence : la boucle d’interrogation ne redémarre pas à chaque rendu.
  const routeur = useRef(router);
  useEffect(() => { routeur.current = router; }, [router]);

  const remettreTitre = useCallback(() => { if (titreBase.current !== null) { document.title = titreBase.current; titreBase.current = null; } }, []);

  const verifier = useCallback(async (): Promise<boolean> => {
    if (enCours.current) return true;
    enCours.current = true;
    try {
      const reponse = await fetch(URL_ETAT, { cache: "no-store", redirect: "manual", headers: { accept: "application/json" } });
      if (!reponse.ok) throw new Error(String(reponse.status));
      const etat = await reponse.json() as EtatCommandes;
      setErreur(false); setAJour(Date.now());
      const avant = precedent.current;
      precedent.current = etat;
      const nouvelleEmpreinte = empreinteEtat(etat);
      if (nouvelleEmpreinte !== empreinte.current) { empreinte.current = nouvelleEmpreinte; routeur.current.refresh(); }
      // Signal seulement pour une commande plus récente que la dernière vue (un changement de statut ne sonne pas).
      if (etat.derniere !== null && etat.derniere > (avant.derniere ?? 0)) {
        const arrivees = Math.max(1, etat.a_confirmer - avant.a_confirmer);
        nombreNouvelles.current += arrivees;
        setNouvelle({ numero: etat.derniere, nombre: nombreNouvelles.current });
        titreBase.current ??= document.title.replace(/^\(\d+\) /, "");
        document.title = `(${nombreNouvelles.current}) ${titreBase.current}`;
        if (sonActif.current) bip();
        navigator.vibrate?.(200);
      }
      return true;
    } catch { setErreur(true); return false; }
    finally { enCours.current = false; }
  }, []);

  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    let arrete = false;
    const planifier = (delai: number) => {
      clearTimeout(minuteur);
      if (arrete || document.visibilityState !== "visible") return; // onglet caché ou téléphone en veille : pas d’interrogation
      minuteur = setTimeout(async () => { const ok = await verifier(); planifier(ok ? INTERVALLE_MS : INTERVALLE_ERREUR_MS); }, delai);
    };
    const visibilite = () => { if (document.visibilityState === "visible") { remettreTitre(); planifier(0); } else clearTimeout(minuteur); };
    const regarde = () => remettreTitre();
    planifier(INTERVALLE_MS);
    document.addEventListener("visibilitychange", visibilite);
    window.addEventListener("pointerdown", regarde);
    window.addEventListener("keydown", regarde);
    return () => { arrete = true; clearTimeout(minuteur); document.removeEventListener("visibilitychange", visibilite); window.removeEventListener("pointerdown", regarde); window.removeEventListener("keydown", regarde); };
  }, [verifier, remettreTitre]);

  const valeur: Valeur = {
    aJour, erreur, son, nouvelle, numeroAuChargement,
    actualiser: () => { void verifier().then(() => routeur.current.refresh()); },
    activerSon: () => { ecrireSon(true); bip(); },
    couperSon: () => ecrireSon(false),
    fermer: () => { nombreNouvelles.current = 0; setNouvelle(null); remettreTitre(); },
  };
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/** « Nouveau » pendant 2 minutes pour une commande arrivée pendant que la page est ouverte. */
export function useEstNouvelle(): (commande: { numero: number; cree_le: string }) => boolean {
  const v = useContext(Contexte);
  return c => Boolean(v && c.numero > v.numeroAuChargement && v.aJour - Date.parse(c.cree_le) < DUREE_NOUVEAU_MS);
}

/** « À jour · 14 h 05 · Actualiser · Activer le son » ou « Connexion perdue, nouvel essai… ». */
export function EtatMiseAJour() {
  const v = useContext(Contexte);
  const textes = useTextes(), t = textes.espace.miseAJour;
  if (!v) return null;
  const heure = heureOran(v.aJour, textes.espace.tableau);
  const lien = "min-h-6 underline";
  return <p className={`mt-0.5 text-xs ${v.erreur ? "text-erreur" : "text-gris"}`} aria-live="polite">
    {remplir(v.erreur ? t.perdue : t.aJour, { heure })}
    {" · "}<button type="button" onClick={v.actualiser} className={`${lien} text-noir`}>{t.actualiser}</button>
    {!v.erreur && (v.son
      ? <> · <span aria-hidden="true">🔊</span> {t.sonActive} · <button type="button" onClick={v.couperSon} className={lien}>{t.couper}</button></>
      : <> · <button type="button" onClick={v.activerSon} className={lien}><span aria-hidden="true">🔈 </span>{t.activerSon}</button></>)}
  </p>;
}

/** Bandeau « Nouvelle commande n° 134 ». */
export function BanniereNouvelle() {
  const v = useContext(Contexte);
  const textes = useTextes(), t = textes.espace.miseAJour;
  if (!v?.nouvelle) return null;
  const { numero, nombre } = v.nouvelle;
  return <div role="status" className="mx-4 mb-2 flex items-center gap-2.5 bg-noir px-3.5 py-2.5 text-blanc lg:mx-8">
    <span aria-hidden="true" className="text-lg">🔔</span>
    <span className="flex-1 text-sm">{remplir(nombre > 1 ? t.nouvelles : t.nouvelle, { n: nombre, numero })}</span>
    <Link href="/espace/commandes?etape=a_confirmer" onClick={v.fermer} className="flex min-h-11 items-center text-[13px] underline">{textes.espace.commun.voir}</Link>
    <button type="button" onClick={v.fermer} aria-label={textes.espace.commun.fermer} className="min-h-11 min-w-8 text-base">×</button>
  </div>;
}
