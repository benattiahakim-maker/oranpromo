"use client";

// US-24.3 : page /carte (filtre par univers, « Autour de moi », mini-fiche, liste).
// La position de la cliente reste dans l'état de ce composant : jamais envoyée (ni action serveur, ni fetch),
// jamais dans l'adresse, un cookie ou le stockage du navigateur ; oubliée en quittant la page.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { aPosition, filtrerParUnivers, formaterDistance, lienItineraire, OPTIONS_LOCALISATION_CLIENTE, trierParDistance, type BoutiqueCarte } from "@/lib/carte";
import { UNIVERS, type CleUnivers } from "@/lib/article";
import { remplir } from "@/lib/langue";
import type { Position } from "@/lib/position";
import { useLangue, useTextes } from "./FournisseurTextes";
import { deVilleEnLangue, nomVille, VILLE_ORAN, type Ville } from "@/lib/ville";

const CarteLeaflet = dynamic(() => import("./CarteLeaflet"), { ssr: false, loading: () => <div className="h-[340px] w-full border-y border-trait bg-[#F2F2F2]" aria-hidden="true" /> });

type EtatLocalisation = "aucun" | "recherche" | "actif" | "refus" | "introuvable";

// US-29.2 : « chemin » = adresse de la carte de la ville (/oran/carte), pour les liens du filtre.
// US-29.3 : « ville » = nom (compteur, nom de la carte), bornes, centre et zoom de la carte (Oran par défaut).
export default function CarteBoutiques({ boutiques, univers: universInitial, chemin = "/carte", ville = VILLE_ORAN }: { boutiques: BoutiqueCarte[]; univers: CleUnivers | null; chemin?: string; ville?: Ville }) {
  const t = useTextes(), langue = useLangue(), c = t.carteBoutiques;
  const [univers, setUnivers] = useState<CleUnivers | null>(universInitial);
  const [selection, setSelection] = useState<string | null>(null);
  const [origine, setOrigine] = useState<Position | null>(null);
  const [localisation, setLocalisation] = useState<EtatLocalisation>("aucun");
  const [indisponible, setIndisponible] = useState(false);

  const filtrees = useMemo(() => filtrerParUnivers(boutiques, univers), [boutiques, univers]);
  const placees = useMemo(() => filtrees.filter(aPosition), [filtrees]);
  const sansPosition = useMemo(() => filtrees.filter(b => !aPosition(b)), [filtrees]);
  const parDistance = useMemo(() => (origine ? trierParDistance(placees, origine) : null), [placees, origine]);
  const distances = useMemo(() => new Map(parDistance?.map(b => [b.id, b.distance]) ?? []), [parDistance]);
  const proches = useMemo(() => parDistance?.slice(0, 3) ?? [], [parDistance]);
  const liste = parDistance ?? placees;
  const choisie = selection ? filtrees.find(b => b.id === selection) ?? null : null;

  const textePromos = useCallback((n: number) => (n === 0 ? c.aucunePromo : remplir(n === 1 ? c.promosUne : c.promos, { n })), [c]);
  const texteDistance = (id: string) => { const d = distances.get(id); return d === undefined ? null : remplir(c.distance, { d: formaterDistance(d, langue) }); };
  const nom = nomVille(ville, langue);
  const libelles = useMemo(() => ({ region: remplir(c.region, { deVille: deVilleEnLangue(ville, langue) }), vous: c.vous, epingle: (b: BoutiqueCarte) => `${b.nom} · ${textePromos(b.promos)}` }), [c, textePromos, ville, langue]);

  // Filtre : un lien (fonctionne sans JavaScript), et avec JavaScript l'adresse change sans recharger ni relire la base.
  function choisirUnivers(evenement: MouseEvent<HTMLAnchorElement>, cle: CleUnivers | null) {
    evenement.preventDefault();
    setUnivers(cle); setSelection(null);
    window.history.replaceState(null, "", cle ? `${chemin}?univers=${cle}` : chemin);
  }

  function autourDeMoi() {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setLocalisation("introuvable"); return; }
    setLocalisation("recherche");
    navigator.geolocation.getCurrentPosition(
      trouvee => { setOrigine({ latitude: trouvee.coords.latitude, longitude: trouvee.coords.longitude }); setLocalisation("actif"); },
      erreur => { setOrigine(null); setLocalisation(erreur.code === 1 ? "refus" : "introuvable"); },
      OPTIONS_LOCALISATION_CLIENTE,
    );
  }

  const nomUnivers = (cle: CleUnivers) => c.univers[cle];
  const total = filtrees.length;
  return <>
    <header className="px-5 pb-4 pt-6 text-center">
      <p className="etiquette text-gris">{remplir(total === 1 ? c.nombreUn : c.nombre, { n: total, ville: nom })}</p>
      <h1 className="mt-2 font-titre text-[28px] font-normal">{c.titre}</h1>
    </header>
    <nav aria-label={c.filtre} className="flex flex-wrap justify-center gap-1 px-3 pb-4">
      {[null, ...UNIVERS.map(u => u.cle)].map(cle => {
        const actif = univers === cle;
        return <a key={cle ?? "tous"} href={cle ? `${chemin}?univers=${cle}` : chemin} aria-current={actif ? "page" : undefined} onClick={evenement => choisirUnivers(evenement, cle)}
          className={`etiquette inline-flex min-h-11 items-center border px-2 text-[10px] ${actif ? "border-noir bg-noir text-blanc" : "border-trait"}`}>{cle ? nomUnivers(cle) : c.tous}</a>;
      })}
    </nav>
    <div className="px-5 pb-4">
      <button type="button" onClick={autourDeMoi} disabled={localisation === "recherche"} aria-pressed={localisation === "actif"}
        className={`etiquette flex min-h-11 w-full items-center justify-center gap-2 border border-noir px-4 ${localisation === "actif" ? "bg-noir text-blanc" : ""}`}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>{localisation === "actif" ? c.autourActif : c.autourDeMoi}
      </button>
      <p className="mt-2 text-center text-xs text-gris">{c.confidentialite}</p>
      {localisation === "recherche" && <p role="status" className="mt-2 text-center text-sm">{c.recherche}</p>}
      {localisation === "refus" && <p role="alert" className="mt-2 text-center text-sm">{c.refus}</p>}
      {localisation === "introuvable" && <div role="alert" className="mt-2 text-center text-sm"><p>{c.introuvable}</p><button type="button" onClick={autourDeMoi} className="etiquette mt-2 min-h-11 border border-noir px-4">{c.reessayer}</button></div>}
    </div>

    {!indisponible && <CarteLeaflet boutiques={placees} origine={origine} proches={proches} selection={selection} onSelection={setSelection} onIndisponible={() => setIndisponible(true)} libelles={libelles} cadre={ville} />}
    {indisponible && <p role="status" className="border-y border-trait px-5 py-6 text-center text-sm">{c.indisponible}</p>}

    {choisie && <section aria-label={choisie.nom} className="border-b border-trait px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="etiquette text-gris">{choisie.quartier}{texteDistance(choisie.id) ? ` · ${texteDistance(choisie.id)}` : ""}</p>
          <h2 className="break-words font-titre text-2xl font-normal">{choisie.nom}</h2>
          <p className="text-sm">{textePromos(choisie.promos)}</p>
        </div>
        <button type="button" onClick={() => setSelection(null)} aria-label={c.fermer} className="inline-flex min-h-11 min-w-11 items-center justify-center text-xl">×</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/b/${choisie.slug}`} className="etiquette flex min-h-11 items-center justify-center bg-noir px-2 text-center text-blanc">{c.voirBoutique}</Link>
        <a href={lienItineraire({ ...choisie, ville: ville.nom })} target="_blank" rel="noopener noreferrer" className="etiquette flex min-h-11 items-center justify-center border border-noir px-2 text-center">{c.itineraire}</a>
      </div>
    </section>}

    <section className="px-5 pb-10 pt-6">
      {total === 0 ? <div className="py-6 text-center">
        <p>{univers ? c.aucuneUnivers : c.aucune}</p>
        {univers && <a href={chemin} onClick={evenement => choisirUnivers(evenement, null)} className="etiquette mt-4 inline-flex min-h-11 items-center border border-noir px-4">{c.voirToutes}</a>}
      </div> : <>
        {liste.length > 0 && <><h2 className="etiquette text-gris">{parDistance ? c.listeProches : c.listeParNom}</h2>
          <ul className="mt-2">{liste.map(b => <LigneBoutique key={b.id} boutique={b} promos={textePromos(b.promos)} distance={distances.get(b.id) === undefined ? null : formaterDistance(distances.get(b.id)!, langue)} />)}</ul></>}
        {sansPosition.length > 0 && <><h2 className="etiquette mt-8 text-gris">{remplir(c.sansPosition, { n: sansPosition.length })}</h2>
          <ul className="mt-2">{sansPosition.map(b => <LigneBoutique key={b.id} boutique={b} promos={textePromos(b.promos)} distance={null} />)}</ul></>}
      </>}
    </section>
  </>;
}

function LigneBoutique({ boutique, promos, distance }: { boutique: BoutiqueCarte; promos: string; distance: string | null }) {
  return <li className="border-b border-trait"><Link href={`/b/${boutique.slug}`} className="flex min-h-14 items-center justify-between gap-3 py-3">
    <span className="min-w-0"><span className="block break-words font-titre text-lg">{boutique.nom}</span><span className="block text-sm text-gris">{boutique.quartier} · {promos}</span></span>
    <span className="shrink-0 text-sm" dir="auto">{distance ?? <span aria-hidden="true" className="rtl:rotate-180 inline-block">›</span>}</span>
  </Link></li>;
}
