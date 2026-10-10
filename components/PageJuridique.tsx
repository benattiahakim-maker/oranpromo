import EntetePublic from "./EntetePublic";
import DocumentJuridique from "./DocumentJuridique";
import { blocsDocument, formaterVersion, VERSION_PROVISOIRE, VERSIONS, type DocumentJuridique as NomDocument } from "@/lib/juridique";
import { remplir, type Langue } from "@/lib/langue";
import { textesDe } from "@/lib/textes";

// US-34.1 : page publique d'un texte juridique : titre, version datée, bandeau « version provisoire »,
// en arabe un bandeau « traduction à venir » (texte français en dessous, traduction juridique à faire faire).
export default function PageJuridique({ document, langue }: { document: NomDocument; langue: Langue }) {
  const t = textesDe(langue).juridique;
  return <><EntetePublic /><main className="mx-auto w-full max-w-lg bg-blanc px-6 pt-6 pb-10 text-noir">
    <h1 className="mb-1 font-titre text-[28px] font-normal leading-tight">{t.titres[document]}</h1>
    <p className="mb-4 text-[13px] text-gris">{remplir(t.version, { date: formaterVersion(VERSIONS[document]) })}</p>
    {VERSION_PROVISOIRE && <p role="note" className="mb-4 border border-noir p-3 text-sm font-medium">{t.provisoire}</p>}
    {langue === "ar" && <p role="note" className="mb-4 border border-trait p-3 text-sm">{t.traductionAttente}</p>}
    <DocumentJuridique blocs={blocsDocument(document)} />
  </main></>;
}
