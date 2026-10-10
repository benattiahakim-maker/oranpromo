import { signauxInscriptions, type InscriptionsBoutique } from "@/lib/inscriptions-admin";

// US-31.4 : bloc « Inscriptions en boutique » de /admin/remboursements : boutiques avec un signal (90 derniers jours).
// Jamais bloquant : aucune action ici ; l'admin décide sur les lignes du relevé.
export default function SignauxInscriptions({ boutiques }: { boutiques: InscriptionsBoutique[] }) {
  const avecSignal = boutiques.map(b => ({ b, signaux: signauxInscriptions(b) })).filter(x => x.signaux.length);
  return <section aria-labelledby="signaux-inscriptions" className="mt-6">
    <h2 id="signaux-inscriptions" className="etiquette">Inscriptions en boutique (90 jours)</h2>
    {avecSignal.length ? <ul>{avecSignal.map(({ b, signaux }) => <li key={b.boutique_id} className="border-b border-trait py-3">
      <p className="text-sm"><span className="break-words">{b.boutique}</span> · {b.inscrits} inscrit{b.inscrits > 1 ? "s" : ""}</p>
      <ul className="mt-1 border-l-2 border-noir pl-2">{signaux.map(s => <li key={s} className="text-xs font-medium">Signal : {s}</li>)}</ul>
    </li>)}</ul> : <p className="py-3 text-sm text-gris">Aucun signal sur les inscriptions en boutique.</p>}
  </section>;
}
