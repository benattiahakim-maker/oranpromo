"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { STATUTS_BOUTIQUE, type RoleAdministration } from "@/lib/boutique";
import { modifierPositionBoutique, modifierStatutBoutique, rattacherCompteBoutique, type ResultatBoutique } from "@/app/admin/boutiques/actions";
import ChoixPosition from "@/components/ChoixPosition";
import { formaterPosition, lireCoordonnee, validerPosition } from "@/lib/position";
import type { Tables } from "@/lib/supabase/types";

export default function BoutiquesAdministration({ boutiques, role }: { boutiques: Tables<"boutiques">[]; role: RoleAdministration }) {
  return boutiques.length ? <ul className="my-6">{boutiques.map(boutique => <LigneBoutique key={boutique.id} boutique={boutique} admin={role === "admin"} />)}</ul> : <p className="my-6">Aucune boutique pour ce statut.</p>;
}
function LigneBoutique({ boutique, admin }: { boutique: Tables<"boutiques">; admin: boolean }) {
  const router = useRouter();
  const [statut, setStatut] = useState(boutique.statut), [email, setEmail] = useState("");
  const [positionOuverte, setPositionOuverte] = useState(false);
  const [latitude, setLatitude] = useState(boutique.latitude?.toFixed(6) ?? ""), [longitude, setLongitude] = useState(boutique.longitude?.toFixed(6) ?? "");
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState(""), [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function agir(action: () => Promise<ResultatBoutique>, nouveauStatut?: Tables<"boutiques">["statut"]) {
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setErreur(""); setMessage("");
    try { const resultat = await action(); if (resultat.succes) { setMessage(resultat.message); if (nouveauStatut) setStatut(nouveauStatut); router.refresh(); } else setErreur(resultat.message); }
    catch { setErreur("Impossible d’effectuer cette action. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  // US-24.2 : l'admin place ou déplace la position de n'importe quelle boutique (deux nombres seulement vers le serveur).
  function enregistrerPosition() {
    const position = validerPosition(lireCoordonnee(latitude), lireCoordonnee(longitude));
    if (!position.ok) { setMessage(""); setErreur(position.message); return; }
    void agir(() => modifierPositionBoutique(boutique.id, position.latitude, position.longitude));
  }
  function rattacher(event: FormEvent) { event.preventDefault(); void agir(() => rattacherCompteBoutique(boutique.id, email)); }
  return <li className="border-b border-trait py-4"><h2 className="break-words font-titre text-[28px] font-normal">{boutique.nom}</h2><p className="text-sm text-gris">{boutique.quartier}</p><p className="etiquette my-3">{STATUTS_BOUTIQUE[statut]}</p><p className="mb-3 text-sm text-gris" dir="auto">{boutique.latitude !== null && boutique.longitude !== null ? `Position : ${formaterPosition({ latitude: boutique.latitude, longitude: boutique.longitude })}` : "Sans position sur la carte"}</p>
    {admin && <fieldset disabled={enCours} className="flex min-w-0 flex-col gap-3"><button type="button" onClick={() => void agir(() => modifierStatutBoutique(boutique.id, statut === "validee" ? "suspendue" : "validee"), statut === "validee" ? "suspendue" : "validee")} className="min-h-[44px] border border-noir bg-noir px-3 py-2 text-blanc">{statut === "en_attente" ? "Valider" : statut === "validee" ? "Suspendre" : "Réactiver"}</button>
      <button type="button" aria-expanded={positionOuverte} onClick={() => setPositionOuverte(ouverte => !ouverte)} className="min-h-[44px] border border-noir px-3 py-2">Position</button>
      {positionOuverte && <div className="border-y border-trait py-4"><ChoixPosition id={`position-${boutique.id}`} latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} /><button type="button" onClick={enregistrerPosition} className="etiquette mt-4 min-h-[44px] w-full border border-noir bg-noir px-3 py-2 text-blanc">Enregistrer la position</button></div>}
      <form onSubmit={rattacher} noValidate><label className="etiquette">E-mail du commerçant<input type="email" aria-label={`E-mail du commerçant pour ${boutique.nom}`} value={email} onChange={event => setEmail(event.target.value)} className="mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base" /></label><button type="submit" className="mt-3 min-h-[44px] w-full border border-noir px-3 py-2">Rattacher</button></form>
    </fieldset>}
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
  </li>;
}
