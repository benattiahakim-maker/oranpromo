// US-29.2 : ancienne adresse / gardée : redirection vers la même page dans la ville gardée (paramètres compris).
import { redirigerVersVille } from "@/lib/redirection-ville";

export const dynamic = "force-dynamic";

export default async function AccueilSansVille({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return redirigerVersVille("", await searchParams);
}
