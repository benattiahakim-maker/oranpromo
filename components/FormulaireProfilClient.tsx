"use client";
import { useRef, useState } from "react";
import { enregistrerNom, enregistrerProfil } from "@/app/compte/actions";
import { telephoneLisible, validerProfilClient, type ErreursProfilClient } from "@/lib/clients";

// US-20.2 : nom et numéro WhatsApp du client, demandés avant la première commande.
// US-21 : telephoneModifiable = false (mode téléphone ou numéro déjà vérifié) → le nom seul ; le numéro change par code.
export default function FormulaireProfilClient({ nom = "", telephone = "", bouton = "Enregistrer", onEnregistre, telephoneModifiable = true }: { nom?: string | null; telephone?: string | null; bouton?: string; onEnregistre?: () => void; telephoneModifiable?: boolean }) {
  const [champs, setChamps] = useState({ nom: nom ?? "", telephone: telephone ? telephoneLisible(telephone) : "" });
  const [erreurs, setErreurs] = useState<ErreursProfilClient>({});
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verrou.current) return;
    const locales = validerProfilClient(telephoneModifiable ? champs : { nom: champs.nom, telephone: "0555000000" });
    setErreurs(locales); setMessage("");
    if (Object.keys(locales).length) return;
    verrou.current = true; setEnCours(true);
    try {
      const resultat = telephoneModifiable ? await enregistrerProfil(champs) : await enregistrerNom(champs.nom);
      setErreurs(resultat.erreurs ?? {}); setMessage(resultat.message);
      if (resultat.succes) onEnregistre?.();
    } finally { verrou.current = false; setEnCours(false); }
  }
  const champ = "box-border min-h-[50px] w-full rounded-none border bg-blanc p-3 font-[inherit] text-base text-noir";
  return <form noValidate onSubmit={envoyer} className="flex flex-col gap-2 text-start">
    <label htmlFor="profil-nom" className="etiquette text-xs">Nom et prénom</label>
    <input id="profil-nom" autoComplete="name" value={champs.nom} disabled={enCours} aria-invalid={Boolean(erreurs.nom)} onChange={e => setChamps({ ...champs, nom: e.target.value })} className={`${champ} ${erreurs.nom ? "border-noir" : "border-trait"}`} />
    {erreurs.nom && <p role="alert" className="m-0 text-sm">{erreurs.nom}</p>}
    {telephoneModifiable && <>
      <label htmlFor="profil-telephone" className="etiquette mt-2 text-xs">Téléphone WhatsApp</label>
      <input id="profil-telephone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0555 12 34 56" value={champs.telephone} disabled={enCours} aria-invalid={Boolean(erreurs.telephone)} onChange={e => setChamps({ ...champs, telephone: e.target.value })} className={`${champ} ${erreurs.telephone ? "border-noir" : "border-trait"}`} />
      {erreurs.telephone && <p role="alert" className="m-0 text-sm">{erreurs.telephone}</p>}
      <p className="m-0 text-[13px] text-gris">La boutique vous contacte sur ce numéro pour votre commande.</p>
    </>}
    <button type="submit" disabled={enCours} className="etiquette mt-2 min-h-[50px] bg-noir px-3 text-blanc">{enCours ? "Enregistrement…" : bouton}</button>
    <p role="status" className="m-0 text-sm">{message}</p>
  </form>;
}
