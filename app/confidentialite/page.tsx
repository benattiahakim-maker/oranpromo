import type { Metadata } from "next";
import PageJuridique from "@/components/PageJuridique";
import { getLangue } from "@/lib/langue-serveur";

export const metadata: Metadata = { title: "Confidentialité", description: "Politique de confidentialité de BleDeal." };

// US-34.1 : texte public, lisible sans compte (version provisoire, en cours de relecture juridique).
export default async function Page() {
  return <PageJuridique document="confidentialite" langue={await getLangue()} />;
}
