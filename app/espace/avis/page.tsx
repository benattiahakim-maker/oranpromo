// US-32.4 : avis de la boutique dans l'espace (maquette ⑦) : moyenne, nombre, avis récents (sans réponse d'abord),
// une réponse publique par avis, non modifiable ; la boutique ne supprime jamais un avis (elle peut le signaler).
import Link from "next/link";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { etoiles, formaterJourMois, lireAvisMaBoutique, lireResumeMaBoutique, texteResumeEspace, type AvisEspace, type ResumeEspace } from "@/lib/avis";
import { fr } from "@/lib/textes/fr";
import ReponseAvis from "@/components/ReponseAvis";
import SignalerAvis from "@/components/SignalerAvis";

export default async function AvisEspacePage() {
  const client = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  let resume: ResumeEspace | null = null, avis: AvisEspace[] = [];
  let erreur = erreurProfil ? "Impossible de charger votre profil. Réessayez." : "";
  if (!erreur && profil?.boutique_id) {
    try { [resume, avis] = await Promise.all([lireResumeMaBoutique(client), lireAvisMaBoutique(client)]); }
    catch (e) { erreur = e instanceof Error ? e.message : "Impossible de charger vos avis. Réessayez."; }
  }
  return <main className="mx-auto w-full max-w-[390px] bg-blanc p-6 text-noir">
    <Link href="/espace" className="etiquette inline-flex min-h-[44px] items-center">← Mes articles</Link>
    <h1 className="my-6 font-titre text-[28px] font-normal">Avis</h1>
    {erreur ? <p role="alert">{erreur}</p> : !profil?.boutique_id ? <p>Votre compte n&apos;est rattaché à aucune boutique</p> : resume && <>
      <p className="font-titre text-2xl">{texteResumeEspace(resume)}</p>
      {resume.nombre > 0 && resume.moyenne === null && <p className="mt-2 text-sm text-gris">La note s’affiche pour les clients à partir de 3 avis.</p>}
      {avis.length ? <ul className="mt-4">{avis.map(a => <li key={a.id} className="border-b border-trait py-4">
        <p className="text-sm"><strong className="font-medium">{a.auteur}</strong><span className="text-gris"> · </span><span role="img" aria-label={`${a.note} étoiles sur 5`}>{etoiles(a.note)}</span><span className="text-gris"> · {formaterJourMois(a.creeLe)}</span></p>
        {a.criteres.length > 0 && <p className="mt-1 text-xs text-gris">{a.criteres.map(c => fr.avis.criteres[c]).join(" · ")}</p>}
        {a.commentaire && <p dir="auto" className="mt-1 text-sm font-light leading-[1.6]">{a.commentaire}</p>}
        {a.reponse ? <p dir="auto" className="mt-2 border-s-2 border-noir ps-3 text-sm text-gris">Votre réponse : {a.reponse}{a.reponseMasquee && <span className="block text-xs">Masquée par la modération : les clients ne la voient plus.</span>}</p> : <ReponseAvis avisId={a.id} />}
        <SignalerAvis avisId={a.id} auteur={a.auteur} t={fr.avis} />
      </li>)}</ul> : <p className="mt-4 text-sm text-gris">Pas encore d’avis. Les clients peuvent noter votre boutique après un retrait avec leur QR code.</p>}
      <p className="mt-6 text-sm text-gris">Vous ne pouvez pas supprimer un avis. Un avis faux ou insultant : « Signaler ».</p>
    </>}
  </main>;
}
