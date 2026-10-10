"use client";

// US-32.4 : onglet « Avis » de /admin/moderation (maquette ⑧) : avis, motifs, nombre de signalements ; décisions
// « Masquer l'avis » (le bon déjà donné n'est pas repris), « Masquer la réponse », « Classer ». Signaux de fraude
// affichés à titre d'information (jamais automatiques).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { etoiles, formaterJourMois } from "@/lib/avis";
import { ACTIONS_MODERATION_AVIS, MOTIFS_SIGNALEMENT_AVIS, type ActionModerationAvis, type GroupeSignalementsAvis, type SignalAvis, texteSignalAvis } from "@/lib/moderation";
import { traiterSignalementsAvis } from "@/app/admin/moderation/actions";

const bouton = "min-h-[44px] w-full border border-noir px-3 py-2 text-sm";
export default function SignalementsAvisModeration({ groupes, signaux }: { groupes: GroupeSignalementsAvis[]; signaux: SignalAvis[] }) {
  return <>
    {groupes.length ? <ul>{groupes.map(groupe => <GroupeAvis key={groupe.avisId} groupe={groupe} />)}</ul> : <p className="my-6">Aucun avis signalé.</p>}
    {signaux.length > 0 && <section aria-labelledby="titre-signaux" className="my-6 border border-trait p-4">
      <h2 id="titre-signaux" className="etiquette text-gris">Signaux (jamais automatiques)</h2>
      <p className="mt-2 text-xs text-gris">Pour information : rien n’est masqué ni bloqué automatiquement. À vérifier avant toute décision.</p>
      <ul>{signaux.map((s, i) => <li key={`${s.signal}-${s.boutiqueId}-${s.detail ?? i}`} className="mt-2 break-words text-sm">{texteSignalAvis(s)}</li>)}</ul>
    </section>}
  </>;
}

function GroupeAvis({ groupe }: { groupe: GroupeSignalementsAvis }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<"masquer_avis" | "masquer_reponse" | null>(null);
  const [enCours, setEnCours] = useState(false), [termine, setTermine] = useState(false);
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState("");
  const verrou = useRef(false);
  const avis = groupe.avis;
  const reponseVisible = Boolean(avis?.reponse && !avis.reponse_masquee);
  async function appliquer(action: ActionModerationAvis) {
    if (verrou.current || termine) return;
    verrou.current = true; setEnCours(true); setErreur(""); setMessage("");
    try {
      const resultat = await traiterSignalementsAvis(groupe.avisId, groupe.signalements.map(s => s.id), action);
      if (resultat.succes) { setTermine(true); setConfirmation(null); setMessage(resultat.message); }
      else setErreur(resultat.message);
      router.refresh();
    } catch { setErreur("Impossible de traiter les signalements. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <li className="border-b border-trait py-6">
    <h2 className="break-words font-titre text-[24px] font-normal">{avis?.boutiques?.nom ?? "Boutique indisponible"}</h2>
    {avis ? <>
      <p className="mt-1 text-sm"><span role="img" aria-label={`${avis.note} étoiles sur 5`}>{etoiles(avis.note)}</span> · {groupe.auteur} · {formaterJourMois(avis.cree_le)}{avis.statut !== "publie" && " · déjà masqué"}</p>
      {avis.commentaire && <p dir="auto" className="mt-2 break-words text-sm">« {avis.commentaire} »</p>}
      {avis.reponse && <p dir="auto" className="mt-2 break-words border-s-2 border-noir ps-3 text-sm text-gris">Réponse de la boutique : {avis.reponse}{avis.reponse_masquee && " (masquée)"}</p>}
    </> : <p className="mt-1 text-sm">Avis indisponible</p>}
    <p className="my-3">{groupe.nombre} signalement{groupe.nombre > 1 ? "s" : ""} : {groupe.motifs.map(m => `${MOTIFS_SIGNALEMENT_AVIS[m.motif] ?? m.motif}${groupe.motifs.length > 1 || m.nombre !== groupe.nombre ? ` (${m.nombre})` : ""}`).join(", ")}</p>
    <ul className="my-3">{groupe.signalements.filter(s => s.commentaire).map(s => <li key={s.id} className="my-2 break-words text-sm">{s.commentaire}</li>)}</ul>
    {!termine && <fieldset disabled={enCours || !avis} className="flex min-w-0 flex-col gap-3">
      {confirmation ? <><p>Confirmer : {ACTIONS_MODERATION_AVIS[confirmation]} ?</p><button type="button" className={`${bouton} bg-noir text-blanc`} onClick={() => void appliquer(confirmation)}>Confirmer</button><button type="button" className={bouton} onClick={() => setConfirmation(null)}>Annuler</button></> : <>
        <button type="button" className={bouton} onClick={() => setConfirmation("masquer_avis")}>Masquer l’avis</button>
        {reponseVisible && <button type="button" className={bouton} onClick={() => setConfirmation("masquer_reponse")}>Masquer la réponse</button>}
        <button type="button" className={bouton} onClick={() => void appliquer("classer_signalement_avis")}>Classer</button>
      </>}
    </fieldset>}
    {enCours && <p role="status" className="mt-4">Enregistrement…</p>}{message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
  </li>;
}
