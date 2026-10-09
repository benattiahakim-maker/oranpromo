import ConnexionEmail from "@/components/ConnexionEmail";
import { cheminSuiteClient } from "@/lib/connexion";

export const metadata = { title: "Se connecter", robots: { index: false, follow: false } };

export default async function ConnexionClient({ searchParams }: { searchParams: Promise<{ erreur?: string; suite?: string }> }) {
  const { erreur, suite } = await searchParams;
  return <main className="mx-auto box-border w-full max-w-[390px] bg-blanc p-6 text-noir">
    <h1 className="my-4 text-center font-titre text-[30px] font-normal">Se connecter</h1>
    <p className="mb-8 text-center text-sm text-gris">Pour commander et suivre vos commandes</p>
    {erreur === "lien" && <p role="alert" className="border border-trait p-4 text-sm leading-[1.6]">Ce lien de connexion est invalide, expiré ou déjà utilisé. Demandez un nouveau lien.</p>}
    <ConnexionEmail suite={cheminSuiteClient(typeof suite === "string" ? suite : null)} />
  </main>;
}
