import Link from "next/link";
import ConnexionEmail from "@/components/ConnexionEmail";
import CodeTelephone from "@/components/CodeTelephone";
import { cheminSuiteClient } from "@/lib/connexion";
import { modeConnexionClient } from "@/lib/telephone";
import { getTextes } from "@/lib/langue-serveur";

export const metadata = { title: "Se connecter", robots: { index: false, follow: false } };

// US-20.2 / US-21.2 : CONNEXION_CLIENT=telephone → numéro + code (lien e-mail en second choix) ; sinon lien e-mail.
export default async function ConnexionClient({ searchParams }: { searchParams: Promise<{ erreur?: string; suite?: string; methode?: string }> }) {
  const { erreur, suite, methode } = await searchParams;
  const t = (await getTextes()).connexion;
  const destination = cheminSuiteClient(typeof suite === "string" ? suite : null);
  const parTelephone = modeConnexionClient() === "telephone" && methode !== "email";
  return <main className="mx-auto box-border w-full max-w-[390px] bg-blanc p-6 text-noir">
    <h1 className="my-4 text-center font-titre text-[30px] font-normal">{t.titre}</h1>
    <p className="mb-8 text-center text-sm text-gris">{t.sousTitre}</p>
    {erreur === "lien" && <p role="alert" className="border border-trait p-4 text-sm leading-[1.6]">{t.lienInvalide}</p>}
    {parTelephone ? <>
      <CodeTelephone usage="connexion" suite={destination} />
      <Link href={`/compte/connexion?methode=email&suite=${encodeURIComponent(destination)}`} className="mt-6 flex min-h-11 items-center justify-center text-sm text-gris underline">{t.avecEmail}</Link>
    </> : <>
      <ConnexionEmail suite={destination} />
      {modeConnexionClient() === "telephone" && <Link href={`/compte/connexion?suite=${encodeURIComponent(destination)}`} className="mt-6 flex min-h-11 items-center justify-center text-sm text-gris underline">{t.avecNumero}</Link>}
    </>}
  </main>;
}
