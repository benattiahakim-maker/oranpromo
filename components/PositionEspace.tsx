"use client";

// US-24.2 : bloc « Position sur la carte » de /espace. Boutique en attente : le commerçant la règle ;
// boutique publiée (validée ou suspendue) : lecture seule, seul OranPromo (admin) la déplace (règle aussi dans la base).
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ChoixPosition from "@/components/ChoixPosition";
import { enregistrerPositionMaBoutique } from "@/app/espace/actions";
import { formaterPosition, lireCoordonnee, MESSAGE_POSITION_PUBLIEE, validerPosition } from "@/lib/position";
import type { Enums } from "@/lib/supabase/types";

const CartePosition = dynamic(() => import("./CartePosition"), { ssr: false, loading: () => <div className="h-[200px] w-full border border-trait bg-[#F2F2F2]" aria-hidden="true" /> });

export type ProprietesPositionEspace = { statut: Enums<"statut_boutique">; latitude: number | null; longitude: number | null };

export default function PositionEspace({ statut, latitude, longitude }: ProprietesPositionEspace) {
  const router = useRouter();
  const [lat, setLat] = useState(latitude?.toFixed(6) ?? ""), [lng, setLng] = useState(longitude?.toFixed(6) ?? "");
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState(""), [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const enAttente = statut === "en_attente";
  const position = latitude != null && longitude != null ? { latitude, longitude } : null;

  async function enregistrer() {
    if (verrou.current) return;
    setMessage(""); setErreur("");
    const valide = validerPosition(lireCoordonnee(lat), lireCoordonnee(lng));
    if (!valide.ok) { setErreur(valide.message); return; }
    verrou.current = true; setEnCours(true);
    try {
      const resultat = await enregistrerPositionMaBoutique(valide.latitude, valide.longitude);
      if (resultat.succes) { setMessage(resultat.message); router.refresh(); } else setErreur(resultat.message);
    } catch { setErreur("Impossible d’enregistrer la position. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }

  return <section aria-labelledby="position-espace-titre" className="mt-8 border-t border-trait pt-6">
    <p className="etiquette text-gris">{enAttente ? "Boutique en attente" : statut === "validee" ? "Boutique validée" : "Boutique suspendue"}</p>
    <h2 id="position-espace-titre" className="my-3 font-titre text-[28px] font-normal">Position sur la carte</h2>
    {enAttente ? <>
      <p className="mb-4 text-sm">Réglez-la avant la validation : ensuite, seul OranPromo pourra la changer.</p>
      <ChoixPosition id="position-espace" latitude={lat} longitude={lng} onChange={(a, b) => { setLat(a); setLng(b); }} desactive={enCours} />
      <button type="button" onClick={() => void enregistrer()} disabled={enCours} className="etiquette mt-4 min-h-[54px] w-full bg-noir px-4 text-blanc">{enCours ? "Enregistrement…" : "Enregistrer la position"}</button>
    </> : <>
      {position ? <><CartePosition position={position} deplacable={false} libelle="Carte de la position de la boutique" /><p className="mt-2 text-sm" dir="ltr">{formaterPosition(position)}</p></> : <p className="text-sm">Votre boutique n’a pas encore de position sur la carte.</p>}
      <p className="mt-3 text-sm">{MESSAGE_POSITION_PUBLIEE}</p>
    </>}
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
  </section>;
}
