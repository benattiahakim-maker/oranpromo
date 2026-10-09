"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

// US-21 : contrôle anti-robot Cloudflare Turnstile avant l'envoi d'un code ou d'un lien de connexion.
// Clé de site publique (NEXT_PUBLIC_TURNSTILE_SITE_KEY) ; la clé secrète est seulement dans Supabase
// (Authentication > Attack Protection), qui vérifie le jeton transmis dans captchaToken.
type OptionsTurnstile = {
  sitekey: string;
  language?: string;
  callback: (jeton: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};
type ApiTurnstile = { render: (element: HTMLElement, options: OptionsTurnstile) => string; reset: (widget: string) => void; remove: (widget: string) => void };
declare global { interface Window { turnstile?: ApiTurnstile } }

export const SCRIPT_TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Affiche le contrôle ; `reinitialiser` change → nouveau contrôle (un jeton ne sert qu'une fois). */
export default function Turnstile({ cle, onJeton, reinitialiser = 0 }: { cle: string; onJeton: (jeton: string | null) => void; reinitialiser?: number }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const rappel = useRef(onJeton);
  const [charge, setCharge] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  useEffect(() => { rappel.current = onJeton; }, [onJeton]);

  useEffect(() => {
    const api = window.turnstile;
    if (!charge || !api || !conteneur.current || widget.current) return;
    widget.current = api.render(conteneur.current, {
      sitekey: cle,
      language: "fr",
      callback: jeton => rappel.current(jeton),
      "expired-callback": () => rappel.current(null),
      "error-callback": () => rappel.current(null),
    });
    return () => { if (widget.current) { api.remove(widget.current); widget.current = null; } };
  }, [charge, cle]);

  useEffect(() => {
    if (reinitialiser > 0 && widget.current && window.turnstile) { window.turnstile.reset(widget.current); rappel.current(null); }
  }, [reinitialiser]);

  return <>
    <Script src={SCRIPT_TURNSTILE} strategy="afterInteractive" onLoad={() => setCharge(true)} onReady={() => setCharge(true)} />
    <div ref={conteneur} className="min-h-[65px]" aria-label="Contrôle anti-robot" />
  </>;
}
