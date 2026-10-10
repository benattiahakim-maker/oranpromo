import EntetePublic from "@/components/EntetePublic";
import ConnexionEmail from "@/components/ConnexionEmail";
import { getTextes } from "@/lib/langue-serveur";

export default async function Connexion({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const t = (await getTextes()).espace.connexion;
  return <><EntetePublic /><main className="mx-auto box-border w-full max-w-[390px] bg-blanc p-6 text-noir">
    <h1 className="my-4 text-center font-titre text-[30px] font-normal">{t.titre}</h1>
    <p className="mb-8 text-center text-sm text-gris">{t.sousTitre}</p>
    {erreur === "lien" && <p role="alert" className="border border-trait p-4 text-sm leading-[1.6]">{t.lienInvalide}</p>}
    <ConnexionEmail />
  </main></>;
}
