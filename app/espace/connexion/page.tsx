import EntetePublic from "@/components/EntetePublic";
import ConnexionEmail from "@/components/ConnexionEmail";

export default async function Connexion({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return <><EntetePublic /><main className="mx-auto box-border w-full max-w-[390px] bg-blanc p-6 text-noir">
    <h1 className="my-4 text-center font-titre text-[30px] font-normal">Se connecter</h1>
    <p className="mb-8 text-center text-sm text-gris">Votre espace commerçant</p>
    {erreur === "lien" && <p role="alert" className="border border-trait p-4 text-sm leading-[1.6]">Ce lien de connexion est invalide, expiré ou déjà utilisé. Demandez un nouveau lien.</p>}
    <ConnexionEmail />
  </main></>;
}
