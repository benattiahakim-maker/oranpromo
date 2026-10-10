// US-32.3 : avis sur la vitrine (maquette docs/maquettes/AvisBoutiques.dc.html, vues ④ ⑤ ⑩) : note, critères les
// plus cités, derniers commentaires, « Voir tous les avis ». US-32.4 : « Signaler » sous chaque avis. US-32.5 : mention du bon (texte n° 11) seulement si la récompense est active.
import Link from "next/link";
import { criteresCites, etoiles, formaterMois, type AvisPublic, type ResumeAvis } from "@/lib/avis";
import { remplir } from "@/lib/langue";
import type { Textes } from "@/lib/textes";
import NoteBoutique from "./NoteBoutique";
import SignalerAvis from "./SignalerAvis";

export function ListeAvis({ avis, t, langue }: { avis: AvisPublic[]; t: Textes["avis"]; langue: "fr" | "ar" }) {
  return <ul className="text-start">{avis.map(a => <li key={a.id} className="border-b border-trait py-4">
    <p className="text-sm"><strong dir="auto" className="font-medium">{a.auteur}</strong>
      <span className="text-gris"> · </span><span role="img" aria-label={remplir(t.noteSur, { n: a.note })} dir="ltr">{etoiles(a.note)}</span>
      <span className="text-gris"> · {formaterMois(a.mois, langue)}</span></p>
    {a.commentaire && <p dir="auto" className="mt-1 text-sm font-light leading-[1.6]">{a.commentaire}</p>}
    {a.reponse && <p dir="auto" className="mt-2 border-s-2 border-noir ps-3 text-sm text-gris">{remplir(t.reponseBoutique, { reponse: a.reponse })}</p>}
    <SignalerAvis avisId={a.id} auteur={a.auteur} t={t} />
  </li>)}</ul>;
}

export default function AvisBoutique({ resume, avis, slug, t, langue, recompense = false }: { resume: ResumeAvis; avis: AvisPublic[]; slug: string; t: Textes["avis"]; langue: "fr" | "ar"; recompense?: boolean }) {
  const cites = criteresCites(resume);
  return <section id="avis" aria-labelledby="titre-avis" className="border-t border-trait px-6 py-6 text-center">
    <h2 id="titre-avis" className="etiquette text-gris">{t.titreSection}</h2>
    <p className="mt-2 font-titre text-2xl"><NoteBoutique resume={resume} t={t} /></p>
    {cites.length > 0 && <p className="mt-2 text-xs text-gris">{cites.map(c => `${t.criteres[c.critere]} · ${c.nombre}`).join("   ")}</p>}
    {recompense && <p className="mx-auto mt-3 max-w-[300px] text-xs leading-[1.6] text-gris">{t.mentionBon}</p>}
    {avis.length > 0 ? <ListeAvis avis={avis} t={t} langue={langue} /> : <p className="mt-3 text-sm text-gris">{t.aucun}</p>}
    {resume.nombre > avis.length && <Link href={`/b/${slug}/avis`} className="etiquette mt-4 flex min-h-11 items-center justify-center border border-noir">{t.voirTous}</Link>}
  </section>;
}
