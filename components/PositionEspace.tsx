"use client";

// US-24.2 : bloc « Position sur la carte » de /espace. Boutique en attente : le commerçant la règle ;
// boutique publiée (validée ou suspendue) : lecture seule, seul BleDeal (admin) la déplace (règle aussi dans la base).
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ChoixPosition from "@/components/ChoixPosition";
import { enregistrerPositionMaBoutique } from "@/app/espace/actions";
import { formaterPosition, lireCoordonnee, validerPosition, ZONE_ORAN, type ZoneVille } from "@/lib/position";
import type { Enums } from "@/lib/supabase/types";
import { useLangue, useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";
import { traduireMessage } from "@/lib/textes/messages";

const CartePosition = dynamic(() => import("./CartePosition"), { ssr: false, loading: () => <div className="h-[200px] w-full border border-trait bg-[#F2F2F2]" aria-hidden="true" /> });

// US-29.4 : « zone » = ville de la boutique (nom affiché, bornes et centre) ; Oran par défaut.
export type ProprietesPositionEspace = { statut: Enums<"statut_boutique">; latitude: number | null; longitude: number | null; zone?: ZoneVille };

export default function PositionEspace({ statut, latitude, longitude, zone = ZONE_ORAN }: ProprietesPositionEspace) {
  const router = useRouter();
  const textes = useTextes(), t = textes.espace.position, langue = useLangue();
  const m = (message: string) => traduireMessage(message, langue);
  const [lat, setLat] = useState(latitude?.toFixed(6) ?? ""), [lng, setLng] = useState(longitude?.toFixed(6) ?? "");
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState(""), [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const enAttente = statut === "en_attente";
  const position = latitude != null && longitude != null ? { latitude, longitude } : null;

  async function enregistrer() {
    if (verrou.current) return;
    setMessage(""); setErreur("");
    const valide = validerPosition(lireCoordonnee(lat), lireCoordonnee(lng), zone);
    if (!valide.ok) { setErreur(m(valide.message)); return; }
    verrou.current = true; setEnCours(true);
    try {
      const resultat = await enregistrerPositionMaBoutique(valide.latitude, valide.longitude);
      if (resultat.succes) { setMessage(resultat.message); router.refresh(); } else setErreur(resultat.message);
    } catch { setErreur(t.impossible); }
    finally { verrou.current = false; setEnCours(false); }
  }

  return <section aria-labelledby="position-espace-titre" className="mt-8 border-t border-trait pt-6">
    <p className="etiquette text-gris">{t.statuts[statut]}</p>
    <h2 id="position-espace-titre" className="my-3 font-titre text-[28px] font-normal">{t.titre}</h2>
    <p className="mb-3 text-sm text-gris">{remplir(t.ville, { ville: zone.nom })}</p>
    {enAttente ? <>
      <p className="mb-4 text-sm">{t.regler}</p>
      <ChoixPosition id="position-espace" zone={zone} t={t} traduireMessage={m} latitude={lat} longitude={lng} onChange={(a, b) => { setLat(a); setLng(b); }} desactive={enCours} />
      <button type="button" onClick={() => void enregistrer()} disabled={enCours} className="etiquette mt-4 min-h-[54px] w-full bg-noir px-4 text-blanc">{enCours ? textes.espace.commun.enregistrement : t.enregistrer}</button>
    </> : <>
      {position ? <><CartePosition position={position} deplacable={false} libelle={t.carte} zone={zone} /><p className="mt-2 text-sm" dir="ltr">{formaterPosition(position)}</p></> : <p className="text-sm">{t.aucune}</p>}
      <p className="mt-3 text-sm">{t.contacter}</p>
    </>}
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
  </section>;
}
