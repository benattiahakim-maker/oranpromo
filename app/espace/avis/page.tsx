// US-32.4 : avis de la boutique dans l'espace (maquette ⑦) : moyenne, nombre, avis récents (sans réponse d'abord),
// une réponse publique par avis, non modifiable ; la boutique ne supprime jamais un avis (elle peut le signaler).
import Link from "next/link";
import Isole from "@/components/Isole";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { etoiles, formaterJourMois, lireAvisMaBoutique, lireResumeMaBoutique, texteResumeEspace, type AvisEspace, type ResumeEspace } from "@/lib/avis";
import { getLangue } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import { traduireMessage } from "@/lib/textes/messages";
import ReponseAvis from "@/components/ReponseAvis";
import SignalerAvis from "@/components/SignalerAvis";

export default async function AvisEspacePage() {
  const client = await creerClientServeur();
  const { data: { user }, error: erreurSession } = await client.auth.getUser();
  if (erreurSession || !user) redirect("/espace/connexion");
  const langue = await getLangue(), textes = textesDe(langue), e = textes.espace, t = e.avis;
  const { data: profil, error: erreurProfil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  let resume: ResumeEspace | null = null, avis: AvisEspace[] = [];
  let erreur = erreurProfil ? e.commun.profilImpossible : "";
  if (!erreur && profil?.boutique_id) {
    try { [resume, avis] = await Promise.all([lireResumeMaBoutique(client), lireAvisMaBoutique(client)]); }
    catch (x) { erreur = x instanceof Error ? traduireMessage(x.message, langue) : t.impossible; }
  }
  return <main className="mx-auto w-full max-w-[390px] bg-blanc p-6 text-noir">
    <Link href="/espace" className="etiquette inline-flex min-h-[44px] items-center">{e.commun.retourMesArticles}</Link>
    <h1 className="my-6 font-titre text-[28px] font-normal">{t.titre}</h1>
    {erreur ? <p role="alert">{erreur}</p> : !profil?.boutique_id ? <p>{e.commun.sansBoutique}</p> : resume && <>
      <p className="font-titre text-2xl">{texteResumeEspace(resume, langue)}</p>
      {resume.nombre > 0 && resume.moyenne === null && <p className="mt-2 text-sm text-gris">{t.seuil}</p>}
      {avis.length ? <ul className="mt-4">{avis.map(a => <li key={a.id} className="border-b border-trait py-4">
        <p className="text-sm"><strong className="font-medium"><Isole langue={langue}>{a.auteur}</Isole></strong><span className="text-gris"> · </span><span role="img" aria-label={remplir(t.etoiles, { n: a.note })}>{etoiles(a.note)}</span><span className="text-gris"> · <Isole langue={langue}>{formaterJourMois(a.creeLe)}</Isole></span></p>
        {a.criteres.length > 0 && <p className="mt-1 text-xs text-gris">{a.criteres.map(c => textes.avis.criteres[c]).join(" · ")}</p>}
        {a.commentaire && <p dir="auto" className="mt-1 text-sm font-light leading-[1.6]">{a.commentaire}</p>}
        {a.reponse ? <p dir="auto" className="mt-2 border-s-2 border-noir ps-3 text-sm text-gris">{remplir(t.votreReponse, { reponse: a.reponse })}{a.reponseMasquee && <span className="block text-xs">{t.masquee}</span>}</p> : <ReponseAvis avisId={a.id} />}
        <SignalerAvis avisId={a.id} auteur={a.auteur} t={textes.avis} />
      </li>)}</ul> : <p className="mt-4 text-sm text-gris">{t.aucun}</p>}
      <p className="mt-6 text-sm text-gris">{t.pasSupprimer}</p>
    </>}
  </main>;
}
