import { Fragment } from "react";
import type { Bloc, Segment } from "@/lib/juridique";

// US-34.1 : affichage d'un texte juridique analysé par lib/juridique (titres, paragraphes, listes, tableaux).
function EnLigne({ segments }: { segments: Segment[] }) {
  return <>{segments.map((s, i) => s.gras ? <strong key={i} className="font-medium">{s.texte}</strong> : <Fragment key={i}>{s.texte}</Fragment>)}</>;
}

export default function DocumentJuridique({ blocs }: { blocs: Bloc[] }) {
  return <div dir="ltr" lang="fr" className="text-start text-sm leading-[1.6]">
    {blocs.map((bloc, i) => {
      if (bloc.type === "titre") return bloc.niveau === 2
        ? <h2 key={i} className="mt-6 mb-2 text-base font-medium"><EnLigne segments={bloc.segments} /></h2>
        : <h3 key={i} className="mt-4 mb-1 text-sm font-medium"><EnLigne segments={bloc.segments} /></h3>;
      if (bloc.type === "paragraphe") return <p key={i} className="mb-3"><EnLigne segments={bloc.segments} /></p>;
      if (bloc.type === "liste") {
        const Liste = bloc.ordonnee ? "ol" : "ul";
        return <Liste key={i} className={`mb-3 ps-5 ${bloc.ordonnee ? "list-decimal" : "list-disc"}`}>{bloc.elements.map((e, j) => <li key={j} className="mb-1"><EnLigne segments={e} /></li>)}</Liste>;
      }
      return <div key={i} className="mb-3 overflow-x-auto"><table className="w-full border-collapse text-xs">
        <thead><tr>{bloc.entetes.map((c, j) => <th key={j} scope="col" className="border border-trait p-2 text-start font-medium"><EnLigne segments={c} /></th>)}</tr></thead>
        <tbody>{bloc.lignes.map((l, j) => <tr key={j}>{l.map((c, k) => <td key={k} className="border border-trait p-2 align-top"><EnLigne segments={c} /></td>)}</tr>)}</tbody>
      </table></div>;
    })}
  </div>;
}
