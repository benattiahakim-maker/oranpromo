"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { envoyerCodeConnexion, verifierCodeConnexion } from "@/app/compte/connexion/actions";
import { envoyerCodeVerification, verifierCodeVerification } from "@/app/compte/actions";
import { telephoneLisible } from "@/lib/clients";
import { MESSAGE_TELEPHONE_INVALIDE, nettoyerCode, normaliserTelephoneClient } from "@/lib/telephone";
import Turnstile from "./Turnstile";
import { remplir } from "@/lib/langue";
import { useTextes } from "./FournisseurTextes";

// US-21.2 : numéro → code à 6 chiffres (WhatsApp uniquement : pas de SMS, décision du propriétaire).
// « connexion » : se connecter ou créer un compte (captcha Turnstile) ; « verification » : compte déjà connecté.
export default function CodeTelephone({ usage, suite = null, numeroInitial = null, onVerifie }: { usage: "connexion" | "verification"; suite?: string | null; numeroInitial?: string | null; onVerifie?: () => void }) {
  const router = useRouter();
  const t = useTextes().code;
  const cleTurnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const captcha = usage === "connexion" && cleTurnstile !== "";
  const [etape, setEtape] = useState<"numero" | "code">("numero");
  const [saisie, setSaisie] = useState(numeroInitial ? telephoneLisible(numeroInitial) : "");
  const [numero, setNumero] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [jeton, setJeton] = useState<string | null>(null);
  const [reinitialiser, setReinitialiser] = useState(0);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);

  async function envoyer() {
    if (verrou.current) return;
    setMessage("");
    const normalise = normaliserTelephoneClient(saisie);
    if (!normalise) { setErreur(MESSAGE_TELEPHONE_INVALIDE); return; }
    if (captcha && !jeton) { setErreur(t.antiRobot); return; }
    verrou.current = true; setEnCours(true); setErreur("");
    try {
      const resultat = usage === "connexion" ? await envoyerCodeConnexion(normalise, jeton) : await envoyerCodeVerification(normalise);
      if (resultat.succes) { setNumero(resultat.numero ?? normalise); setCode(""); setEtape("code"); setMessage(resultat.message); }
      else setErreur(resultat.message);
    } catch { setErreur(t.envoiImpossible); }
    finally {
      verrou.current = false; setEnCours(false);
      if (captcha) { setJeton(null); setReinitialiser(n => n + 1); } // un jeton Turnstile ne sert qu'une fois
    }
  }

  async function verifier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verrou.current || !numero) return;
    const propre = nettoyerCode(code);
    if (!propre) { setErreur(t.saisir); return; }
    verrou.current = true; setEnCours(true); setErreur(""); setMessage("");
    try {
      if (usage === "connexion") {
        const resultat = await verifierCodeConnexion(numero, propre, suite);
        if (!resultat.succes) { setErreur(resultat.message); return; }
        router.replace(resultat.suite ?? "/compte/commandes");
        router.refresh();
      } else {
        const resultat = await verifierCodeVerification(numero, propre);
        if (!resultat.succes) { setErreur(resultat.message); return; }
        setMessage(resultat.message);
        onVerifie?.();
        router.refresh();
      }
    } catch { setErreur(t.verificationImpossible); }
    finally { verrou.current = false; setEnCours(false); }
  }

  const champ = "box-border min-h-[50px] w-full rounded-none border border-trait bg-blanc p-3 font-[inherit] text-base text-noir";
  if (etape === "code" && numero) return <form noValidate onSubmit={verifier} className="flex flex-col gap-3 text-start">
    <p role="status" className="m-0 text-sm leading-[1.6]">{message || remplir(t.envoye, { numero: `\u2066${telephoneLisible(numero)}\u2069` })}</p>
    <label htmlFor="code-telephone" className="etiquette text-xs">{t.code}</label>
    <input id="code-telephone" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} disabled={enCours}
      onChange={e => { setCode(e.target.value); setErreur(""); }} aria-invalid={Boolean(erreur)} className={`${champ} tracking-[0.3em]`} />
    {erreur && <p role="alert" className="m-0 text-sm">{erreur}</p>}
    <button type="submit" disabled={enCours} className="etiquette min-h-[54px] bg-noir px-3 text-xs text-blanc disabled:opacity-50">{enCours ? t.verification : t.valider}</button>
    <button type="button" disabled={enCours} onClick={() => { setEtape("numero"); setErreur(""); setMessage(""); }} className="min-h-11 text-sm text-gris underline">{t.changer}</button>
  </form>;

  return <form noValidate onSubmit={e => { e.preventDefault(); void envoyer(); }} className="flex flex-col gap-3 text-start">
    <label htmlFor="numero-telephone" className="etiquette text-xs">{t.numero}</label>
    <input id="numero-telephone" dir="ltr" type="tel" inputMode="tel" autoComplete="tel" placeholder="0555 12 34 56" value={saisie} disabled={enCours}
      onChange={e => { setSaisie(e.target.value); setErreur(""); }} aria-invalid={Boolean(erreur)} aria-describedby="aide-numero-telephone" className={champ} />
    <p id="aide-numero-telephone" className="m-0 text-[13px] text-gris">{t.aide}</p>
    {captcha && <Turnstile cle={cleTurnstile} onJeton={setJeton} reinitialiser={reinitialiser} />}
    {erreur && <p role="alert" className="m-0 text-sm">{erreur}</p>}
    <button type="submit" disabled={enCours || (captcha && !jeton)} className="etiquette min-h-[54px] bg-noir px-3 text-xs text-blanc disabled:opacity-50">{enCours ? t.envoi : t.recevoir}</button>
  </form>;
}
