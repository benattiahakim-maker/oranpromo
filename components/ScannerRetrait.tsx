"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lireRetraitParCode } from "@/app/espace/retrait/actions";
import { codeRetraitValide, jetonDepuisQr, LONGUEUR_CODE_RETRAIT, MESSAGE_CAMERA_BLOQUEE, MESSAGE_PAS_QR_RETRAIT, type ResumeRetrait } from "@/lib/retrait";
import RetraitBoutique from "./RetraitBoutique";

// US-26.3 : scanner de la boutique (maquette ⑤). Caméra arrière dans la page ; lecteur intégré du navigateur
// (BarcodeDetector) s'il lit les QR codes, sinon jsqr chargée à la demande (iPhone, Firefox ; décision 1 du 9/10).
// Aucune image ne quitte le téléphone : seul le texte du QR code lu est utilisé.

type Detecteur = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type ClasseDetecteur = { new (options: { formats: string[] }): Detecteur; getSupportedFormats?: () => Promise<string[]> };
type Lecteur = { lire: (video: HTMLVideoElement) => Promise<string | null>; intervalle: number };
type Lampe = MediaTrackCapabilities & { torch?: boolean };

async function creerLecteur(): Promise<Lecteur> {
  const Classe = (globalThis as { BarcodeDetector?: ClasseDetecteur }).BarcodeDetector;
  if (Classe) {
    try {
      // Certains Android sans services Google ont l'objet sans le format QR.
      const formats = Classe.getSupportedFormats ? await Classe.getSupportedFormats() : [];
      if (formats.includes("qr_code")) {
        const detecteur = new Classe({ formats: ["qr_code"] });
        return { intervalle: 160, lire: async video => (await detecteur.detect(video))[0]?.rawValue ?? null };
      }
    } catch { /* repli sur jsqr */ }
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const contexte = canvas.getContext("2d", { willReadFrequently: true });
  return {
    intervalle: 250,
    lire: async video => {
      if (!contexte || !video.videoWidth || !video.videoHeight) return null;
      const echelle = Math.min(1, 480 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * echelle);
      canvas.height = Math.round(video.videoHeight * echelle);
      contexte.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = contexte.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
    },
  };
}

export default function ScannerRetrait() {
  const router = useRouter();
  const routeur = useRef(router);
  useEffect(() => { routeur.current = router; }, [router]);
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const [camera, setCamera] = useState<"demarrage" | "active" | "bloquee">("demarrage");
  const [lampe, setLampe] = useState<boolean | null>(null);
  const [avis, setAvis] = useState("");
  const [code, setCode] = useState("");
  const [saisie, setSaisie] = useState(false);
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resume, setResume] = useState<{ resume: ResumeRetrait; code: string } | null>(null);

  // Chaque démarrage ou arrêt change de génération : une caméra ouverte en retard (double effet, onglet caché) est refermée.
  const arreter = useCallback(() => {
    generation.current += 1;
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    flux.current?.getTracks().forEach(piste => piste.stop());
    flux.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const demarrer = useCallback(async () => {
    arreter();
    const g = generation.current;
    const encore = () => generation.current === g;
    try {
      // Sans HTTPS (ou navigateur trop ancien), mediaDevices n'existe pas.
      const appareils = navigator.mediaDevices;
      const nouveau = await (appareils?.getUserMedia
        ? appareils.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        : Promise.reject(new Error("caméra indisponible")));
      if (!encore()) { nouveau.getTracks().forEach(piste => piste.stop()); return; }
      flux.current = nouveau;
      const element = video.current;
      if (!element) { arreter(); return; }
      element.srcObject = nouveau;
      await element.play().catch(() => undefined);
      const piste = nouveau.getVideoTracks()[0];
      setLampe((piste?.getCapabilities?.() as Lampe | undefined)?.torch ? false : null);
      setCamera("active");
      const lecteur = await creerLecteur();
      if (!encore()) return;
      const boucle = async () => {
        if (!encore()) return;
        let texte: string | null = null;
        try { texte = element.readyState >= 2 ? await lecteur.lire(element) : null; } catch { texte = null; }
        if (!encore()) return;
        if (texte) {
          const jeton = jetonDepuisQr(texte);
          if (jeton) { arreter(); routeur.current.push(`/espace/retrait/${jeton}`); return; }
          setAvis(MESSAGE_PAS_QR_RETRAIT);
        }
        minuteur.current = setTimeout(() => void boucle(), lecteur.intervalle);
      };
      void boucle();
    } catch {
      if (!encore()) return;
      // Refus, pas de caméra, caméra prise par une autre application, pas de HTTPS : le code reste utilisable.
      arreter();
      setCamera("bloquee");
    }
  }, [arreter]);

  const scanne = resume === null;
  useEffect(() => {
    if (!scanne) return;
    // Abonnement à un système extérieur (la caméra) : l'état change seulement après l'ouverture ou le refus de la caméra.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void demarrer();
    const visibilite = () => { if (document.hidden) arreter(); else void demarrer(); };
    document.addEventListener("visibilitychange", visibilite);
    return () => { document.removeEventListener("visibilitychange", visibilite); arreter(); };
  }, [demarrer, arreter, scanne]);

  async function basculerLampe() {
    const piste = flux.current?.getVideoTracks()[0];
    if (!piste || lampe === null) return;
    try { await piste.applyConstraints({ advanced: [{ torch: !lampe } as MediaTrackConstraintSet] }); setLampe(!lampe); } catch { setLampe(null); }
  }

  async function chercher(e: React.FormEvent) {
    e.preventDefault();
    if (enCours) return;
    if (!codeRetraitValide(code)) { setMessage("Tapez les 6 chiffres du code."); return; }
    setEnCours(true); setMessage("");
    try {
      const resultat = await lireRetraitParCode(code);
      if (resultat.succes && resultat.resume) { arreter(); setResume({ resume: resultat.resume, code }); }
      else setMessage(resultat.message);
    } catch { setMessage("Impossible de lire cette commande. Vérifiez votre connexion."); }
    finally { setEnCours(false); }
  }

  if (resume) return <RetraitBoutique resume={resume.resume} cle={{ code: resume.code }} onAutre={() => { setResume(null); setCode(""); setMessage(""); setAvis(""); setCamera("demarrage"); }} />;

  return <section aria-label="Scanner" className="px-6 py-5">
    <p className="text-sm">Placez le QR code du client dans le cadre.</p>
    <div className="relative mt-3 aspect-square w-full overflow-hidden bg-noir">
      <video ref={video} autoPlay muted playsInline aria-label="Caméra" className="size-full object-cover" />
      {camera === "active" && <span aria-hidden="true" className="pointer-events-none absolute inset-[18%] border-2 border-blanc/80" />}
      {camera === "demarrage" && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-blanc">Ouverture de la caméra…</p>}
      {camera === "bloquee" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border border-trait bg-blanc p-5 text-center">
        <p role="alert" className="text-sm">{MESSAGE_CAMERA_BLOQUEE}</p>
        <p className="text-xs text-gris">Dans WhatsApp ou Instagram, ouvrez votre espace dans Chrome ou Safari.</p>
        <button type="button" onClick={() => { setCamera("demarrage"); setAvis(""); void demarrer(); }} className="etiquette min-h-11 border border-noir px-4">Réessayer la caméra</button>
      </div>}
      {camera === "active" && lampe !== null && <button type="button" aria-pressed={lampe} onClick={() => void basculerLampe()} className="absolute bottom-3 right-3 min-h-11 bg-blanc px-3 text-xs">Lampe</button>}
    </div>
    {avis && <p role="status" className="mt-2 text-sm">{avis}</p>}
    <form noValidate onSubmit={e => void chercher(e)} className="mt-5">
      <label htmlFor="code-retrait" className="text-sm">La caméra ne marche pas ? Tapez le code à 6 chiffres</label>
      {/* Suivi de la relecture n°6 : 6 cases. Un seul vrai champ (collage, clavier numérique, lecteur d'écran) posé
          sur les cases, transparent ; les cases montrent les chiffres et la case en cours. */}
      <div dir="ltr" className="relative mt-2">
        <div aria-hidden="true" className="grid grid-cols-6 gap-2">
          {Array.from({ length: LONGUEUR_CODE_RETRAIT }, (_, i) =>
            <span key={i} data-case-code={i} className={`flex h-14 items-center justify-center border text-[28px] ${saisie && i === Math.min(code.length, LONGUEUR_CODE_RETRAIT - 1) ? "border-2 border-noir" : "border-noir"}`}>{code[i] ?? ""}</span>)}
        </div>
        <input id="code-retrait" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={LONGUEUR_CODE_RETRAIT} autoComplete="off" value={code}
          onFocus={() => setSaisie(true)} onBlur={() => setSaisie(false)}
          onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, LONGUEUR_CODE_RETRAIT)); setMessage(""); }}
          className="absolute inset-0 box-border size-full rounded-none border-0 bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent" />
      </div>
      <button type="submit" disabled={enCours} className="etiquette mt-3 min-h-12 w-full bg-noir text-blanc">Voir la commande</button>
      {message && <p role="alert" className="mt-3 border border-trait p-3 text-sm">{message}</p>}
    </form>
    <p className="mt-4 text-center"><Link href="/espace/commandes" className="inline-flex min-h-11 items-center text-sm underline">Retour aux commandes</Link></p>
  </section>;
}
