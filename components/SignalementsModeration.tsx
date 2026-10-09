"use client";

import { useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ACTIONS_MODERATION, MOTIFS_SIGNALEMENT, type ActionModeration, type GroupeSignalements } from "@/lib/moderation";
import { lienAvertissementBoutique } from "@/lib/whatsapp";
import { traiterSignalements } from "@/app/admin/moderation/actions";

const bouton = "min-h-[44px] w-full border border-noir px-3 py-2 text-sm";
export default function SignalementsModeration({ groupes }: { groupes: GroupeSignalements[] }) {
  return groupes.length ? <ul>{groupes.map(groupe => <GroupeModeration key={groupe.articleId} groupe={groupe} />)}</ul> : <p className="my-6">Aucun signalement ouvert.</p>;
}
function GroupeModeration({ groupe }: { groupe: GroupeSignalements }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<"masquer" | "suspendre" | null>(null);
  const [enCours, setEnCours] = useState(false), [termine, setTermine] = useState(false);
  const [message, setMessage] = useState(""), [erreur, setErreur] = useState("");
  const verrou = useRef(false);
  const origine = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const article = groupe.article;
  const photo = [...(article?.photos ?? [])].sort((a, b) => a.ordre - b.ordre)[0];
  const lien = origine && article?.boutiques?.whatsapp ? lienAvertissementBoutique(article.boutiques.whatsapp, article.titre, `${origine}/a/${groupe.articleId}`) : null;
  async function appliquer(action: ActionModeration) {
    if (verrou.current || termine) return;
    verrou.current = true; setEnCours(true); setErreur(""); setMessage("");
    try {
      const resultat = await traiterSignalements(groupe.articleId, groupe.signalements.map(s => s.id), action);
      if (resultat.succes) { setTermine(true); setConfirmation(null); setMessage(action === "avertir" ? "Décisions enregistrées. Envoyez le message dans WhatsApp pour avertir la boutique." : resultat.message); router.refresh(); }
      else { setErreur(resultat.message); router.refresh(); }
    } catch { setErreur("Impossible de traiter les signalements. Réessayez."); }
    finally { verrou.current = false; setEnCours(false); }
  }
  function avertir(event: MouseEvent<HTMLAnchorElement>) { if (verrou.current || termine) event.preventDefault(); else void appliquer("avertir"); }
  return <li className="border-b border-trait py-6">
    <div className="flex gap-3">{photo && <Image src={photo.adresse} alt={article?.titre ?? "Article signalé"} width={64} height={80} className="h-20 w-16 shrink-0 object-cover" />}<div className="min-w-0"><h2 className="break-words font-titre text-[28px] font-normal">{article?.titre ?? "Article indisponible"}</h2><p className="text-sm text-gris">{article?.boutiques?.nom ?? "Boutique indisponible"}</p></div></div>
    <p className="my-3">{groupe.nombre} signalement{groupe.nombre > 1 ? "s" : ""}</p><p className="text-sm text-gris">Le plus récent : <time dateTime={groupe.derniereDate}>{new Date(groupe.derniereDate).toLocaleString("fr-FR")}</time></p>
    <ul className="my-3">{groupe.motifs.map(m => <li key={m.motif} className="text-sm break-words">{MOTIFS_SIGNALEMENT[m.motif] ?? m.motif} : {m.nombre}</li>)}</ul>
    <ul className="my-3">{groupe.signalements.filter(s => s.commentaire).map(s => <li key={s.id} className="my-3 break-words text-sm">{s.commentaire}</li>)}</ul>
    {!termine && <fieldset disabled={enCours || !article} className="flex min-w-0 flex-col gap-3">
      {confirmation ? <><p>Confirmer : {ACTIONS_MODERATION[confirmation]} ?</p><button type="button" className={`${bouton} bg-noir text-blanc`} onClick={() => void appliquer(confirmation)}>Confirmer {confirmation === "masquer" ? "le masquage" : "la suspension"}</button><button type="button" className={bouton} onClick={() => setConfirmation(null)}>Annuler</button></> : <>
        <button type="button" className={bouton} onClick={() => setConfirmation("masquer")}>Masquer l’article</button>
        {lien && !enCours ? <a href={lien} target="_blank" rel="noopener noreferrer" className={`${bouton} flex items-center justify-center`} onClick={avertir}>Avertir la boutique</a> : <button disabled type="button" className={bouton}>Avertir la boutique</button>}
        <button type="button" className={bouton} onClick={() => setConfirmation("suspendre")}>Suspendre la boutique</button>
        <button type="button" className={bouton} onClick={() => void appliquer("classer")}>Classer sans suite</button>
      </>}
    </fieldset>}
    {enCours && <p role="status" className="mt-4">Enregistrement…</p>}{message && <p role="status" className="mt-4">{message}</p>}{erreur && <p role="alert" className="mt-4">{erreur}</p>}
  </li>;
}
