"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NOM_BOUTIQUE_MAX, validerBoutique, type ErreursBoutique, type SaisieBoutique } from "@/lib/boutique";
import { ajouterBoutique } from "@/app/admin/boutiques/actions";
import ChoixPosition from "@/components/ChoixPosition";
import { ZONE_ORAN } from "@/lib/position";
import type { VilleAdmin } from "@/lib/villes-admin";

const vide: SaisieBoutique = { nom: "", quartier: "", adresse: "", latitude: "", longitude: "", horaires: "", whatsapp: "", instagram: "", facebook: "", ville: "" };
const champs: { nom: Exclude<keyof SaisieBoutique, "ville">; texte: string; placeholder?: string }[] = [{ nom: "nom", texte: "Nom *" }, { nom: "quartier", texte: "Quartier *" }, { nom: "adresse", texte: "Adresse *" }, { nom: "horaires", texte: "Horaires (facultatifs)" }, { nom: "whatsapp", texte: "Numéro WhatsApp *", placeholder: "0555 12 34 56" }, { nom: "instagram", texte: "Instagram (facultatif)", placeholder: "https://www.instagram.com/…" }, { nom: "facebook", texte: "Facebook (facultatif)", placeholder: "https://www.facebook.com/…" }];
/** US-29.4 : ville présélectionnée : celle de l'ambassadeur, sinon la seule ville ouverte (Oran aujourd'hui), sinon aucune. */
export function villeInitiale(villes: readonly Pick<VilleAdmin, "code" | "ouverte">[], villeImposee: string | null): string {
  if (villeImposee) return villeImposee;
  const ouvertes = villes.filter(ville => ville.ouverte);
  return ouvertes.length === 1 ? ouvertes[0].code : "";
}
// US-29.4 : « villes » = toutes les villes (ouvertes ou non) ; « villeImposee » = ville de l'ambassadeur (champ verrouillé).
export default function NouvelleBoutique({ villes = [], villeImposee = null }: { villes?: VilleAdmin[]; villeImposee?: string | null }) {
  const router = useRouter();
  const depart = { ...vide, ville: villeInitiale(villes, villeImposee) };
  const [saisie, setSaisie] = useState(depart), [erreurs, setErreurs] = useState<ErreursBoutique>({});
  const zone = villes.find(ville => ville.code === saisie.ville) ?? ZONE_ORAN;
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState(""), [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function envoyer(event: FormEvent) {
    event.preventDefault(); if (verrou.current) return;
    const validation = validerBoutique(saisie, zone); setErreurs(validation); setMessage(""); setErreur("");
    if (Object.keys(validation).length) return;
    verrou.current = true; setEnCours(true);
    try { const resultat = await ajouterBoutique(saisie); if (resultat.succes) { setMessage(resultat.message); setSaisie(depart); router.refresh(); } else { setErreur(resultat.message); setErreurs(resultat.erreurs ?? {}); } }
    catch { setErreur("Impossible de créer la boutique. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <section aria-labelledby="nouvelle-boutique" className="mt-8 border-t border-trait pt-6"><h2 id="nouvelle-boutique" className="my-6 font-titre text-[28px] font-normal">Nouvelle boutique</h2>
    <form onSubmit={event => void envoyer(event)} noValidate><fieldset disabled={enCours} className="flex min-w-0 flex-col gap-5">
      <label className="etiquette">Ville (wilaya) *<select name="ville" value={saisie.ville} disabled={Boolean(villeImposee)} onChange={event => setSaisie(avant => ({ ...avant, ville: event.target.value }))} aria-invalid={Boolean(erreurs.ville)} aria-describedby="erreur-boutique-ville" className="mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base normal-case tracking-normal text-noir"><option value="">Choisir la ville</option>{villes.map(ville => <option key={ville.code} value={ville.code}>{ville.nom}{ville.ouverte ? "" : " (fermée)"}</option>)}</select>{erreurs.ville && <span role="alert" id="erreur-boutique-ville" className="mt-2 block text-sm normal-case tracking-normal">{erreurs.ville}</span>}</label>{champs.map(champ => <div key={champ.nom} className="contents"><label className="etiquette">{champ.texte}<input name={champ.nom} type={champ.nom === "whatsapp" ? "tel" : "text"} value={saisie[champ.nom]} maxLength={champ.nom === "nom" ? NOM_BOUTIQUE_MAX : undefined} placeholder={champ.placeholder} onChange={event => setSaisie(avant => ({ ...avant, [champ.nom]: event.target.value }))} aria-invalid={Boolean(erreurs[champ.nom])} aria-describedby={`erreur-boutique-${champ.nom}`} className="mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base text-noir" />{erreurs[champ.nom] && <span role="alert" id={`erreur-boutique-${champ.nom}`} className="mt-2 block text-sm normal-case tracking-normal">{erreurs[champ.nom]}</span>}</label>
      {champ.nom === "adresse" && <div className="border-y border-trait py-5"><ChoixPosition id="position-nouvelle" zone={zone} latitude={saisie.latitude} longitude={saisie.longitude} onChange={(latitude, longitude) => setSaisie(avant => ({ ...avant, latitude, longitude }))} />{(erreurs.latitude || erreurs.longitude) && <p role="alert" className="mt-3 text-sm">{erreurs.latitude ?? erreurs.longitude}</p>}</div>}</div>)}<button type="submit" className="etiquette min-h-[44px] border border-noir bg-noir px-3 py-2 text-blanc">{enCours ? "Création…" : "Créer la boutique"}</button></fieldset></form>
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
  </section>;
}
