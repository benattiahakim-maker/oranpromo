// US-29.2 : ancienne adresse /catalogue gardée : redirection vers la même page dans la ville gardée (paramètres compris).
import { redirigerVersVille } from "@/lib/redirection-ville";

export const dynamic = "force-dynamic";

export default async function CatalogueSansVille({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return redirigerVersVille("/catalogue", await searchParams);
}
