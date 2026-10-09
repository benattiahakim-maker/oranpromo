"use client";

import { useRef, useState } from "react";
import { emailValide, envoyerLienConnexion } from "@/lib/connexion";

export default function ConnexionEmail() {
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
      await envoyerLienConnexion(email, window.location.origin);
      setMessage("Un lien de connexion vous a été envoyé par e-mail");
    } catch { setErreur("Impossible d’envoyer le lien de connexion. Réessayez dans quelques instants."); }
    finally { envoi.current = false; setEnCours(false); }
  }

  return <form noValidate onSubmit={envoyer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <label htmlFor="email" className="etiquette" style={{ fontSize: 12 }}>Adresse e-mail</label>
    <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required value={email} disabled={enCours}
      onChange={event => { setEmail(event.target.value); setErreur(""); setMessage(""); }}
      aria-invalid={Boolean(erreur)} aria-describedby={erreur ? "erreur-email" : "aide-email"}
      style={{ minHeight: 50, width: "100%", boxSizing: "border-box", border: "1px solid #E6E6E6", borderRadius: 0, padding: "12px", background: "#FFFFFF", color: "#0A0A0A", font: "inherit", fontSize: 16 }} />
    {erreur && <p id="erreur-email" role="alert" style={{ margin: 0, fontSize: 14 }}>{erreur}</p>}
    <p id="aide-email" style={{ margin: 0, fontSize: 13, color: "#6F6F6F" }}>Recevez un lien pour vous connecter sans mot de passe.</p>
    <button type="submit" disabled={enCours} className="etiquette" style={{ minHeight: 54, marginTop: 12, border: 0, borderRadius: 0, padding: "14px 12px", background: "#0A0A0A", color: "#FFFFFF", font: "inherit", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: enCours ? "wait" : "pointer", opacity: enCours ? 0.5 : 1 }}>{enCours ? "Envoi en cours…" : "Recevoir mon lien de connexion"}</button>
    <p role="status" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{message}</p>
  </form>;
}
