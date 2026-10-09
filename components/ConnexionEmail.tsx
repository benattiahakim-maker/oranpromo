"use client";

import { useRef, useState } from "react";
import { emailValide, envoyerLienConnexion, ErreurConnexion } from "@/lib/connexion";

export default function ConnexionEmail({ suite = "/espace" }: { suite?: string }) {
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const envoi = useRef(false);

  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (envoi.current) return;
    setMessage("");
    if (!emailValide(email)) { setErreur("Saisissez une adresse e-mail valide."); return; }
    envoi.current = true; setEnCours(true); setErreur("");
    try {
      await envoyerLienConnexion(email, window.location.origin, suite);
      setMessage("Un lien de connexion vous a été envoyé par e-mail");
    } catch (error) { setErreur(error instanceof ErreurConnexion ? error.message : "Impossible d’envoyer le lien de connexion. Réessayez dans quelques instants."); }
    finally { envoi.current = false; setEnCours(false); }
  }

  return <form noValidate onSubmit={envoyer} className="flex flex-col gap-3">
    <label htmlFor="email" className="etiquette text-xs">Adresse e-mail</label>
    <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required value={email} disabled={enCours}
      onChange={event => { setEmail(event.target.value); setErreur(""); setMessage(""); }}
      aria-invalid={Boolean(erreur)} aria-describedby={erreur ? "erreur-email" : "aide-email"}
      className="box-border min-h-[50px] w-full rounded-none border border-trait bg-blanc p-3 font-[inherit] text-base text-noir" />
    {erreur && <p id="erreur-email" role="alert" className="m-0 text-sm">{erreur}</p>}
    <p id="aide-email" className="m-0 text-[13px] text-gris">Recevez un lien pour vous connecter sans mot de passe.</p>
    <button type="submit" disabled={enCours} className="etiquette mt-3 min-h-[54px] cursor-pointer rounded-none border-0 bg-noir px-3 py-3.5 font-[inherit] text-xs tracking-[0.1em] text-blanc disabled:cursor-wait disabled:opacity-50">{enCours ? "Envoi en cours…" : "Recevoir mon lien de connexion"}</button>
    <p role="status" className="m-0 text-sm leading-[1.6]">{message}</p>
  </form>;
}
