import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import Numero from "@/components/Numero";
import { fr } from "@/lib/textes/fr";
import { formaterVersion } from "@/lib/juridique";
import { formaterDate } from "@/lib/donnees-compte";
import { chercherAcceptations, compterAcceptations, CONTEXTES, type CompteAcceptations, type CompteVersion } from "@/lib/acceptations-admin";

export const dynamic = "force-dynamic";

// US-34.4 : registre des acceptations (lecture seule) : nombre par version, et liste par compte (numéro ou nom).
export default async function RegistreAcceptations({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch (error) { return <main className="p-6"><h1 className="font-titre text-[28px]">{error instanceof Error ? error.message : "Accès réservé"}</h1></main>; }
  let versions: CompteVersion[] = [], comptes: CompteAcceptations[] | null = null, erreur = "";
  try { [versions, comptes] = await Promise.all([compterAcceptations(client), chercherAcceptations(client, q)]); }
  catch (e) { erreur = e instanceof Error ? e.message : "Impossible de charger les acceptations. Réessayez."; }
  const titres = fr.juridique.titres;
  return <main className="p-6 text-noir">
    <h1 className="my-6 font-titre text-[28px] font-normal">Acceptations</h1>
    {erreur && <p role="alert" className="my-4">{erreur}</p>}
    <section aria-labelledby="par-version"><h2 id="par-version" className="etiquette text-gris">Par version</h2>
      <ul>{versions.map(v => <li key={`${v.document}-${v.version}`} className="flex justify-between gap-3 border-b border-trait py-3 text-sm">
        <span>{titres[v.document]} · version du {formaterVersion(v.version)}</span><span className="whitespace-nowrap font-medium">{v.nombre.toLocaleString("fr-FR")}</span></li>)}</ul>
    </section>
    <section aria-labelledby="par-compte" className="mt-8"><h2 id="par-compte" className="etiquette text-gris">Par compte</h2>
      <form method="get" action="/admin/acceptations" className="mt-3 flex flex-col gap-2">
        <label htmlFor="q" className="text-sm">Numéro ou nom (3 caractères au moins)</label>
        <input id="q" name="q" defaultValue={q ?? ""} className="min-h-[44px] border border-noir px-3" autoComplete="off" />
        <button type="submit" className="etiquette min-h-[44px] bg-noir text-blanc">Chercher</button>
      </form>
      {q !== undefined && comptes === null && !erreur && <p className="mt-3 text-sm">Écrivez au moins 3 caractères.</p>}
      {comptes && (comptes.length ? <ul aria-label="Comptes" className="mt-4">{comptes.map(c => <li key={c.id} className="border-t border-trait py-4">
        <p className="text-[15px]">{c.nom ?? "Sans nom"} · {c.telephone ? <Numero telephone={c.telephone} /> : "sans numéro"} · {c.role}</p>
        {c.accords.length ? <ul className="mt-2">{c.accords.map((a, i) => <li key={i} className="py-1 text-sm">
          {titres[a.document]}, version du {formaterVersion(a.version)} · accepté le {formaterDate(a.accepteLe)} {CONTEXTES[a.contexte] ?? a.contexte}</li>)}</ul>
          : <p className="mt-2 text-sm text-gris">Aucune acceptation.</p>}
      </li>)}</ul> : <p className="mt-4 text-sm">Aucun compte trouvé.</p>)}
      <p className="mt-6 text-xs leading-[1.6] text-gris">Lecture seule : une acceptation ne se modifie ni ne se supprime (preuve).</p>
    </section>
  </main>;
}
