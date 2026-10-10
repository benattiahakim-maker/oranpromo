import Link from "next/link";
import { creerClientServeur } from "@/lib/supabase/server";
import { LIBELLES_DECISIONS, chargerHistoriqueModeration, chargerMotsInterdits, chargerSignalements, chargerSignalementsAvis, chargerSignauxAvis, verifierAdministrateur, type DecisionHistorique, type GroupeSignalements, type GroupeSignalementsAvis, type SignalAvis } from "@/lib/moderation";
import SignalementsModeration from "@/components/SignalementsModeration";
import SignalementsAvisModeration from "@/components/SignalementsAvisModeration";
import MotsInterdits from "@/components/MotsInterdits";

// US-32.4 : onglet « Avis » (signalements d'avis) entre les signalements d'articles et l'historique.
// US-32 (suite) : onglet « Mots interdits » (liste du filtre des avis, tenue par l'admin).
const ONGLETS = [["ouverts", "Signalements ouverts"], ["avis", "Avis"], ["mots", "Mots interdits"], ["historique", "Historique"]] as const;

export default async function Moderation({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch (error) { return <main className="p-6"><h1 className="font-titre text-[28px]">{error instanceof Error ? error.message : "Accès réservé"}</h1></main>; }
  const demande = (await searchParams).onglet;
  const actif = demande === "historique" || demande === "avis" || demande === "mots" ? demande : "ouverts";
  const historique = actif === "historique";
  let decisions: DecisionHistorique[] = [], groupes: GroupeSignalements[] = [], groupesAvis: GroupeSignalementsAvis[] = [], signaux: SignalAvis[] = [], mots: string[] = [], erreurChargement = false;
  try {
    if (historique) decisions = await chargerHistoriqueModeration(client);
    else if (actif === "avis") [groupesAvis, signaux] = await Promise.all([chargerSignalementsAvis(client), chargerSignauxAvis(client).catch(() => [])]);
    else if (actif === "mots") mots = await chargerMotsInterdits(client);
    else groupes = await chargerSignalements(client);
  } catch { erreurChargement = true; }
  const contenu = erreurChargement ? <p role="alert" className="my-6">Impossible de charger la modération. Réessayez.</p> : historique ? decisions.length ? <ul>{decisions.map(decision => <li key={decision.id} className="border-b border-trait py-4"><p className="break-words">{decision.titre}</p><p className="my-3 text-sm">{LIBELLES_DECISIONS[decision.action] ?? decision.action}</p><time dateTime={decision.date} className="text-sm text-gris">{new Date(decision.date).toLocaleString("fr-FR")}</time></li>)}</ul> : <p className="my-6">Aucune décision enregistrée.</p> : actif === "mots" ? <MotsInterdits mots={mots} /> : actif === "avis" ? <SignalementsAvisModeration groupes={groupesAvis} signaux={signaux} /> : <SignalementsModeration groupes={groupes} />;
  return <main className="p-6 text-noir"><h1 className="my-6 font-titre text-[28px] font-normal">Modération</h1><nav aria-label="Onglets de modération" className="my-6 grid grid-cols-2 gap-3">{ONGLETS.map(([onglet, titre]) => <Link key={onglet} href={`/admin/moderation?onglet=${onglet}`} aria-current={onglet === actif ? "page" : undefined} className={`flex min-h-[44px] items-center justify-center border border-noir px-3 text-sm ${onglet === actif ? "bg-noir text-blanc" : "bg-blanc text-noir"}`}>{titre}</Link>)}</nav>{contenu}</main>;
}
