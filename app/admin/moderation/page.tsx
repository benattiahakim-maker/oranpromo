import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { ACTIONS_MODERATION, chargerHistoriqueModeration, chargerSignalements, verifierAdministrateur, type ActionModeration, type DecisionHistorique, type GroupeSignalements } from "@/lib/moderation";
import SignalementsModeration from "@/components/SignalementsModeration";

export default async function Moderation({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch (error) { return <main className="p-6"><h1 className="font-titre text-[28px]">{error instanceof Error ? error.message : "Accès réservé"}</h1></main>; }
  const historique = (await searchParams).onglet === "historique";
  let decisions: DecisionHistorique[] = [], groupes: GroupeSignalements[] = [], erreurChargement = false;
  try {
    if (historique) decisions = await chargerHistoriqueModeration(client);
    else groupes = await chargerSignalements(client);
  } catch { erreurChargement = true; }
  const contenu = erreurChargement ? <p role="alert" className="my-6">Impossible de charger la modération. Réessayez.</p> : historique ? decisions.length ? <ul>{decisions.map(decision => <li key={decision.id} className="border-b border-trait py-4"><p className="break-words">{decision.titre}</p><p className="my-3 text-sm">{ACTIONS_MODERATION[decision.action as ActionModeration] ?? decision.action}</p><time dateTime={decision.date} className="text-sm text-gris">{new Date(decision.date).toLocaleString("fr-FR")}</time></li>)}</ul> : <p className="my-6">Aucune décision enregistrée.</p> : <SignalementsModeration groupes={groupes} />;
  return <main className="p-6 text-noir"><h1 className="my-6 font-titre text-[28px] font-normal">Modération</h1><nav aria-label="Onglets de modération" className="my-6 flex gap-3">{[["ouverts", "Signalements ouverts"], ["historique", "Historique"]].map(([onglet, titre]) => <Link key={onglet} href={`/admin/moderation?onglet=${onglet}`} aria-current={(onglet === "historique") === historique ? "page" : undefined} className={`flex min-h-[44px] flex-1 items-center justify-center border border-noir px-3 text-sm ${(onglet === "historique") === historique ? "bg-noir text-blanc" : "bg-blanc text-noir"}`}>{titre}</Link>)}</nav>{contenu}</main>;
}
