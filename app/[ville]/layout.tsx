// US-29.2 : pages d'une ville (/oran, /oran/catalogue, /oran/carte). Ville inconnue ou fermée : page de choix
// « Cette ville n'est pas encore sur BleDeal. » ; adresse qui n'a pas la forme d'un code de ville : page introuvable.
import { notFound, redirect } from "next/navigation";
import { getVilleOuverte } from "@/lib/ville-serveur";
import { codeVilleValide } from "@/lib/ville";

export default async function LayoutVille({ children, params }: { children: React.ReactNode; params: Promise<{ ville: string }> }) {
  const { ville } = await params;
  if (!codeVilleValide(ville)) notFound();
  if (!(await getVilleOuverte(ville))) redirect(`/villes?inconnue=${encodeURIComponent(ville)}`);
  return children;
}
