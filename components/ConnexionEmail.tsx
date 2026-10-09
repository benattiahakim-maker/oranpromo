"use client";

import { useRef, useState } from "react";
import { emailValide, envoyerLienConnexion, ErreurConnexion } from "@/lib/connexion";
import Turnstile from "./Turnstile";
import { useLangue, useTextes } from "./FournisseurTextes";
import { traduireMessage } from "@/lib/textes/messages";

export default function ConnexionEmail({ suite = "/espace" }: { suite?: string }) {
  const t = useTextes().connexion;
  const langue = useLangue();
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const envoi = useRef(false);
  // US-21 : quand la protection anti-robot est activée dans Supabase, toute connexion demande le contrôle Turnstile.
  const cleTurnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const [jeton, setJeton] = useState<string | null>(null);
  const [reinitialiser, setReinitialiser] = useState(0);

  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (envoi.current) return;
    setMessage("");
    if (!emailValide(email)) { setErreur(t.emailInvalide); return; }
    if (cleTurnstile && !jeton) { setErreur(t.antiRobot); return; }
    envoi.current = true; setEnCours(true); setErreur("");
    try {
      await envoyerLienConnexion(email, window.location.origin, suite, jeton);
      setMessage(t.emailEnvoye);
    } catch (error) { setErreur(error instanceof ErreurConnexion ? traduireMessage(error.message, langue) : t.emailImpossible); }
    finally {
      envoi.current = false; setEnCours(false);
      if (cleTurnstile) { setJeton(null); setReinitialiser(n => n + 1); } // un jeton ne sert qu'une fois
    }
  }

  return <form noValidate onSubmit={envoyer} className="flex flex-col gap-3">
    <label htmlFor="email" className="etiquette text-xs">{t.email}</label>
    <input id="email" dir="ltr" name="email" type="email" autoComplete="email" inputMode="email" required value={email} disabled={enCours}
      onChange={event => { setEmail(event.target.value); setErreur(""); setMessage(""); }}
      aria-invalid={Boolean(erreur)} aria-describedby={erreur ? "erreur-email" : "aide-email"}
      className="box-border min-h-[50px] w-full rounded-none border border-trait bg-blanc p-3 font-[inherit] text-base text-noir" />
    {erreur && <p id="erreur-email" role="alert" className="m-0 text-sm">{erreur}</p>}
    <p id="aide-email" className="m-0 text-[13px] text-gris">{t.emailAide}</p>
    {cleTurnstile && <Turnstile cle={cleTurnstile} onJeton={setJeton} reinitialiser={reinitialiser} />}
    <button type="submit" disabled={enCours || Boolean(cleTurnstile && !jeton)} className="etiquette mt-3 min-h-[54px] cursor-pointer rounded-none border-0 bg-noir px-3 py-3.5 font-[inherit] text-xs tracking-[0.1em] text-blanc disabled:cursor-wait disabled:opacity-50">{enCours ? t.envoi : t.emailRecevoir}</button>
    <p role="status" className="m-0 text-sm leading-[1.6]">{message}</p>
  </form>;
}
