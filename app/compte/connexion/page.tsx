import Link from "next/link";
import ConnexionEmail from "@/components/ConnexionEmail";
import CodeTelephone from "@/components/CodeTelephone";
import { cheminSuiteClient } from "@/lib/connexion";
import { modeConnexionClient } from "@/lib/telephone";

export const metadata = { title: "Se connecter", robots: { index: false, follow: false } };

// US-20.2 / US-21.2 : CONNEXION_CLIENT=telephone → numéro + code (lien e-mail en second choix) ; sinon lien e-mail.
export default async function ConnexionClient({ searchParams }: { searchParams: Promise<{ erreur?: string; suite?: string; methode?: string }> }) {
  const { erreur, suite, methode } = await searchParams;
  const destination = cheminSuiteClient(typeof suite === "string" ? suite : null);
  const parTelephone = modeConnexionClient() === "telephone" && methode !== "email";
  return <main className="mx-auto box-border w-full max-w-[390px] bg-blanc p-6 text-noir">
    <h1 className="my-4 text-center font-titre text-[30px] font-normal">Se connecter</h1>
    <p className="mb-8 text-center text-sm text-gris">Pour commander et suivre vos commandes</p>
    {erreur === "lien" && <p role="alert" className="border border-trait p-4 text-sm leading-[1.6]">Ce lien de connexion est invalide, expiré ou déjà utilisé. Demandez un nouveau lien.</p>}
    {parTelephone ? <>
      <CodeTelephone usage="connexion" suite={destination} />
      <Link href={`/compte/connexion?methode=email&suite=${encodeURIComponent(destination)}`} className="mt-6 flex min-h-11 items-center justify-center text-sm text-gris underline">Se connecter avec un e-mail (compte déjà créé par e-mail)</Link>
    </> : <>
      <ConnexionEmail suite={destination} />
      {modeConnexionClient() === "telephone" && <Link href={`/compte/connexion?suite=${encodeURIComponent(destination)}`} className="mt-6 flex min-h-11 items-center justify-center text-sm text-gris underline">Se connecter avec mon numéro de téléphone</Link>}
    </>}
  </main>;
}
