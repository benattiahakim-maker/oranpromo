"use client";

// US-24.2 : bloc « Position sur la carte » (création d'une boutique, /admin/boutiques, /espace).
// Rien n'est envoyé au serveur ici : le bloc ne fait que remplir deux nombres, enregistrés par le formulaire parent.
// Un lien Google Maps est lu dans le navigateur, sur le texte seul : il n'est jamais ouvert (ni ici, ni par le serveur).
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import Coordonnees from "./Coordonnees";
import { remplirAvec } from "./Numero";
import {
  arrondirCoordonnee, coordonneesDepuisTexte, dansZone, lireCoordonnee, messageHorsVille, messageLecture,
  MESSAGE_LOCALISATION_INDISPONIBLE, MESSAGE_LOCALISATION_INTROUVABLE, MESSAGE_LOCALISATION_REFUSEE,
  OPTIONS_LOCALISATION_BOUTIQUE, textePrecision, ZONE_ORAN, type Position, type ZoneVille,
} from "@/lib/position";
import { fr } from "@/lib/textes/fr";

const CartePosition = dynamic(() => import("./CartePosition"), { ssr: false, loading: () => <div className="h-[200px] w-full border border-trait bg-[#F2F2F2]" aria-hidden="true" /> });

// US-29.4 : « zone » = bornes et centre de la ville de la boutique (Oran par défaut, comme avant).
export type ProprietesChoixPosition = { id: string; latitude: string; longitude: string; onChange: (latitude: string, longitude: string) => void; desactive?: boolean; zone?: ZoneVille;
  /** US-35 : textes de l'espace commerçant (français par défaut : création de boutique et admin restent en français). */
  t?: typeof fr.espace.position; traduireMessage?: (message: string) => string };

// Position affichable sur la carte : les deux champs lisibles et dans la wilaya de la zone (Oran par défaut).
export function positionDepuisChamps(latitude: string, longitude: string, zone: ZoneVille = ZONE_ORAN): Position | null {
  const lat = lireCoordonnee(latitude), lng = lireCoordonnee(longitude);
  return lat !== null && lng !== null && dansZone(zone, lat, lng) ? { latitude: lat, longitude: lng } : null;
}
const enTexte = (valeur: number) => arrondirCoordonnee(valeur).toFixed(6);

export default function ChoixPosition({ id, latitude, longitude, onChange, desactive = false, zone = ZONE_ORAN, t = fr.espace.position, traduireMessage: m = x => x }: ProprietesChoixPosition) {
  const [etat, setEtat] = useState<{ type: "aucun" | "recherche" | "ok" | "erreur"; texte?: string; avertissement?: string | null }>({ type: "aucun" });
  const [lien, setLien] = useState("");
  const [messageLien, setMessageLien] = useState<{ ok: boolean; texte: ReactNode } | null>(null);
  const position = positionDepuisChamps(latitude, longitude, zone);

  function placer(nouvelle: Position) { onChange(enTexte(nouvelle.latitude), enTexte(nouvelle.longitude)); }

  function localiser() {
    setMessageLien(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) { setEtat({ type: "erreur", texte: m(MESSAGE_LOCALISATION_INDISPONIBLE) }); return; }
    setEtat({ type: "recherche", texte: t.recherche });
    navigator.geolocation.getCurrentPosition(
      trouvee => {
        const { latitude: lat, longitude: lng, accuracy } = trouvee.coords;
        if (!dansZone(zone, lat, lng)) { setEtat({ type: "erreur", texte: m(messageHorsVille(zone.nom)) }); return; }
        placer({ latitude: lat, longitude: lng });
        const precision = textePrecision(accuracy, t);
        setEtat({ type: "ok", texte: precision.texte, avertissement: precision.avertissement });
      },
      erreur => setEtat({ type: "erreur", texte: m(erreur.code === 1 ? MESSAGE_LOCALISATION_REFUSEE : MESSAGE_LOCALISATION_INTROUVABLE) }),
      OPTIONS_LOCALISATION_BOUTIQUE,
    );
  }

  function lireLien() {
    const lecture = coordonneesDepuisTexte(lien, zone);
    if (!lecture.ok) { setMessageLien({ ok: false, texte: m(messageLecture(lecture.raison, zone)) }); return; }
    placer(lecture); setEtat({ type: "aucun" });
    setMessageLien({ ok: true, texte: remplirAvec(t.lue, { position: <Coordonnees position={lecture} /> }) });
  }

  function deplacer(nouvelle: Position) {
    if (!dansZone(zone, nouvelle.latitude, nouvelle.longitude)) { setEtat({ type: "erreur", texte: m(messageHorsVille(zone.nom)) }); return; }
    placer(nouvelle);
  }

  const champ = "mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base text-noir";
  return <fieldset disabled={desactive} className="flex min-w-0 flex-col gap-3" aria-describedby={`${id}-aide`}>
    <legend className="etiquette mb-2">{t.titre}</legend>
    <p id={`${id}-aide`} className="text-sm text-gris">{t.facultative}</p>
    <button type="button" onClick={localiser} className="etiquette min-h-[44px] border border-noir bg-noir px-3 py-2 text-blanc">{t.jeSuis}</button>
    {etat.type !== "aucun" && <div role={etat.type === "erreur" ? "alert" : "status"} className="text-sm">
      {etat.type === "ok" ? <p>✓ {etat.texte}</p> : <p>{etat.texte}</p>}
      {etat.avertissement && <p className="mt-2 border border-noir px-3 py-2">⚠ {etat.avertissement}</p>}
    </div>}
    <CartePosition position={position} deplacable={!desactive} onDeplacer={deplacer} libelle={t.carte} zone={zone} />
    <p className="text-sm text-gris">{position ? t.deplacez : t.touchez}</p>
    {position && <div className="flex items-center justify-between gap-3 text-sm"><Coordonnees position={position} testId={`${id}-coordonnees`} /><button type="button" onClick={() => { onChange("", ""); setEtat({ type: "aucun" }); setMessageLien(null); }} className="min-h-[44px] underline">{t.retirer}</button></div>}
    <p className="etiquette mt-2 text-center text-gris">{t.ou}</p>
    <label className="etiquette" htmlFor={`${id}-lien`}>{t.collerLien}</label>
    <div className="flex gap-2"><input id={`${id}-lien`} type="url" inputMode="url" value={lien} onChange={evenement => { setLien(evenement.target.value); setMessageLien(null); }} onKeyDown={evenement => { if (evenement.key === "Enter") { evenement.preventDefault(); lireLien(); } }} placeholder="https://www.google.com/maps/…/@35.69…" dir="ltr" className="min-h-[44px] min-w-0 flex-1 border border-trait bg-blanc px-3 py-2 text-base text-noir" /><button type="button" onClick={lireLien} className="etiquette min-h-[44px] border border-noir px-4">{t.lire}</button></div>
    {messageLien && <p role={messageLien.ok ? "status" : "alert"} className="text-sm">{messageLien.ok ? "✓ " : ""}{messageLien.texte}</p>}
    <p className="text-sm text-gris">{t.aideLien}</p>
    <details className="text-sm"><summary className="min-h-[44px] cursor-pointer py-3 underline">{t.aLaMain}</summary>
      <div className="flex flex-col gap-3">
        <label className="etiquette">{t.latitude}<input name="latitude" type="text" inputMode="decimal" dir="ltr" value={latitude} placeholder="35,697120" onChange={evenement => onChange(evenement.target.value, longitude)} className={champ} /></label>
        <label className="etiquette">{t.longitude}<input name="longitude" type="text" inputMode="decimal" dir="ltr" value={longitude} placeholder="−0,633750" onChange={evenement => onChange(latitude, evenement.target.value)} className={champ} /></label>
      </div>
    </details>
  </fieldset>;
}
