"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accepterConditionsEspace } from "@/app/espace/conditions/actions";
import { CHEMINS, formaterVersion, VERSION_PROVISOIRE } from "@/lib/juridique";
import { MESSAGE_CONDITIONS_CHANGEES, type DocumentAAccepter } from "@/lib/acceptations";
import { useLangue, useTextes } from "@/components/FournisseurTextes";
import { remplir } from "@/lib/langue";
import { traduireMessage } from "@/lib/textes/messages";
import { fr } from "@/lib/textes/fr";

// US-34.3 : à la première visite de l'espace (et à chaque nouvelle version importante), à la place de la page
// demandée : résumé en 5 points (conception, docs/user-stories.md), lien vers les textes entiers, case et « Accepter ».
// US-35 : l'écran suit la langue de l'espace, résumé des engagements compris (textes `espace.conditions.resume1…5`,
// à valider) ; le texte juridique entier reste en français : en arabe, l'avis « le texte officiel est en français » est affiché.
const C = fr.espace.conditions;
export const RESUME_CONDITIONS_COMMERCANTS = [C.resume1, C.resume2, C.resume3, C.resume4, C.resume5] as const;

export default function AccepterConditionsCommercant({ documents }: { documents: DocumentAAccepter[] }) {
  const router = useRouter();
  const textes = useTextes(), t = textes.espace.conditions, langue = useLangue();
  const [coche, setCoche] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const version = documents.find(d => d.document === "conditions_commercants")?.version ?? documents.map(d => d.version).sort().at(-1) ?? "";

  async function accepter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verrou.current || !coche) return;
    verrou.current = true; setEnCours(true); setErreur("");
    try {
      const resultat = await accepterConditionsEspace(documents);
      if (resultat.ok) { router.refresh(); return; }
      setErreur(resultat.erreur ?? traduireMessage("Impossible d’enregistrer votre accord. Réessayez.", langue));
      if (resultat.erreur?.includes("rechargez") || resultat.erreur === traduireMessage(MESSAGE_CONDITIONS_CHANGEES, langue)) { setCoche(false); router.refresh(); }
    } catch { setErreur(t.connexionPerdue); }
    finally { verrou.current = false; setEnCours(false); }
  }

  return <main className="mx-auto box-border w-full max-w-lg bg-blanc p-6 text-noir">
    <h1 className="my-4 font-titre text-[28px] font-normal">{t.titre}</h1>
    <p className="text-sm leading-[1.6]">{remplir(t.intro, { version: formaterVersion(version) })}</p>
    {langue !== "fr" && <p role="note" className="mt-3 border border-noir p-3 text-sm">{t.francais}</p>}
    {VERSION_PROVISOIRE && <p role="note" className="mt-3 border border-noir p-3 text-sm">{t.provisoire}</p>}
    <ol className="mt-4 list-decimal ps-5 text-sm leading-[1.6]">{[t.resume1, t.resume2, t.resume3, t.resume4, t.resume5].map(point => <li key={point} className="mb-2">{point}</li>)}</ol>
    <p className="flex flex-wrap gap-x-4 text-sm">
      <Link href={CHEMINS.conditions_commercants} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center underline">{t.lire}</Link>
      <Link href={CHEMINS.confidentialite} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center underline">{t.confidentialite}</Link>
    </p>
    <form onSubmit={accepter} className="mt-4 flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-3 border border-noir p-3">
        <input type="checkbox" checked={coche} disabled={enCours} onChange={e => { setCoche(e.target.checked); setErreur(""); }} className="mt-0.5 h-5 w-5 shrink-0" />
        <span className="text-sm leading-[1.6]">{remplir(t.case, { version: formaterVersion(version) })}</span>
      </label>
      {erreur && <p role="alert" className="m-0 text-sm">{erreur}</p>}
      <button type="submit" disabled={enCours || !coche} className="etiquette min-h-[54px] bg-noir px-3 text-xs text-blanc">{enCours ? textes.espace.commun.enregistrement : t.accepter}</button>
    </form>
  </main>;
}
