"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { validerBoutique, type ErreursBoutique, type SaisieBoutique } from "@/lib/boutique";
import { ajouterBoutique } from "@/app/admin/boutiques/actions";

const vide: SaisieBoutique = { nom: "", quartier: "", adresse: "", latitude: "", longitude: "", horaires: "", whatsapp: "", instagram: "", facebook: "" };
const champs: { nom: keyof SaisieBoutique; texte: string; placeholder?: string }[] = [{ nom: "nom", texte: "Nom *" }, { nom: "quartier", texte: "Quartier *" }, { nom: "adresse", texte: "Adresse *" }, { nom: "latitude", texte: "Latitude (facultative)", placeholder: "35,7" }, { nom: "longitude", texte: "Longitude (facultative)", placeholder: "−0,6" }, { nom: "horaires", texte: "Horaires (facultatifs)" }, { nom: "whatsapp", texte: "Numéro WhatsApp *", placeholder: "0555 12 34 56" }, { nom: "instagram", texte: "Instagram (facultatif)", placeholder: "https://www.instagram.com/…" }, { nom: "facebook", texte: "Facebook (facultatif)", placeholder: "https://www.facebook.com/…" }];
export default function NouvelleBoutique() {
  const router = useRouter();
  const [saisie, setSaisie] = useState(vide), [erreurs, setErreurs] = useState<ErreursBoutique>({});
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState(""), [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function envoyer(event: FormEvent) {
    event.preventDefault(); if (verrou.current) return;
    const validation = validerBoutique(saisie); setErreurs(validation); setMessage(""); setErreur("");
    if (Object.keys(validation).length) return;
    verrou.current = true; setEnCours(true);
    try { const resultat = await ajouterBoutique(saisie); if (resultat.succes) { setMessage(resultat.message); setSaisie(vide); router.refresh(); } else { setErreur(resultat.message); setErreurs(resultat.erreurs ?? {}); } }
    catch { setErreur("Impossible de créer la boutique. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <section aria-labelledby="nouvelle-boutique" className="mt-8 border-t border-trait pt-6"><h2 id="nouvelle-boutique" className="my-6 font-titre text-[28px] font-normal">Nouvelle boutique</h2>
    <form onSubmit={event => void envoyer(event)} noValidate><fieldset disabled={enCours} className="flex min-w-0 flex-col gap-5">{champs.map(champ => <label key={champ.nom} className="etiquette">{champ.texte}<input name={champ.nom} type={champ.nom === "whatsapp" ? "tel" : "text"} inputMode={["latitude", "longitude"].includes(champ.nom) ? "decimal" : undefined} value={saisie[champ.nom]} placeholder={champ.placeholder} onChange={event => setSaisie(avant => ({ ...avant, [champ.nom]: event.target.value }))} aria-invalid={Boolean(erreurs[champ.nom])} aria-describedby={`erreur-boutique-${champ.nom}`} className="mt-2 min-h-[44px] w-full border border-trait bg-blanc px-3 py-2 text-base text-noir" />{erreurs[champ.nom] && <span role="alert" id={`erreur-boutique-${champ.nom}`} className="mt-2 block text-sm normal-case tracking-normal">{erreurs[champ.nom]}</span>}</label>)}<button type="submit" className="etiquette min-h-[44px] border border-noir bg-noir px-3 py-2 text-blanc">{enCours ? "Création…" : "Créer la boutique"}</button></fieldset></form>
    {message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
  </section>;
}
