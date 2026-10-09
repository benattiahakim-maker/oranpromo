import { creerClientServeur } from "@/lib/supabase/server";
import { verifierAdministrateur } from "@/lib/moderation";
import { chargerTableauDeBord } from "@/lib/tableau-de-bord";
import { lienRelanceBoutique } from "@/lib/whatsapp";

export default async function TableauDeBord() {
  const client = await creerClientServeur();
  try { await verifierAdministrateur(client); }
  catch (error) { return <main className="p-6"><h1 className="font-titre text-[28px]">{error instanceof Error ? error.message : "Accès réservé"}</h1></main>; }
  let activite;
  try { activite = await chargerTableauDeBord(client); }
  catch { return <main className="p-6"><h1 className="font-titre text-[28px]">Tableau de bord</h1><p role="alert" className="my-6">Impossible de charger l’activité. Réessayez.</p></main>; }
  const chiffres = [["Boutiques validées", activite.boutiquesValidees], ["Boutiques en attente", activite.boutiquesEnAttente], ["Articles en ligne", activite.articlesEnLigne], ["Promos en cours", activite.promosEnCours], ["Clics Réserver · 7 jours", activite.clics7Jours], ["Clics Réserver · 30 jours", activite.clics30Jours], ["Signalements ouverts", activite.signalementsOuverts]] as const;
  return <main className="p-6 text-noir">
    <h1 className="my-6 font-titre text-[28px] font-normal">Tableau de bord</h1>
    <dl>{chiffres.map(([titre, nombre]) => <div key={titre} className="border-b border-trait py-4"><dt className="text-sm text-gris">{titre}</dt><dd className="font-titre text-[28px]">{nombre.toLocaleString("fr-FR")}</dd></div>)}</dl>
    <h2 className="my-6 font-titre text-[28px] font-normal">À relancer</h2>
    {activite.aRelancer.length ? <ul>{activite.aRelancer.map(b => <li key={b.id} className="border-b border-trait py-4">
      <h3 className="break-words font-normal">{b.nom}</h3><p className="text-sm text-gris break-words">{b.quartier}</p>
      <p className="my-3 text-sm">Dernière mise à jour : {b.derniereMiseAJour ? <time dateTime={b.derniereMiseAJour}>{new Date(b.derniereMiseAJour).toLocaleDateString("fr-FR")}</time> : "Aucun article"}</p>
      <a href={lienRelanceBoutique(b.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] items-center justify-center bg-noir px-3 py-2 text-sm text-blanc">Relancer sur WhatsApp</a>
    </li>)}</ul> : <p className="my-6">Aucune boutique à relancer.</p>}
  </main>;
}
