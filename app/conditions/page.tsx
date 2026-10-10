import type { Metadata } from "next";
import PageJuridique from "@/components/PageJuridique";
import { getLangue } from "@/lib/langue-serveur";

export const metadata: Metadata = { title: "Conditions d’utilisation", description: "Conditions d’utilisation de BleDeal pour les clients." };

// US-34.1 : texte public, lisible sans compte (version provisoire, en cours de relecture juridique).
export default async function Page() {
  return <PageJuridique document="conditions" langue={await getLangue()} />;
}
