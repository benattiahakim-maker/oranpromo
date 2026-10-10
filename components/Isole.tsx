import type { ReactNode } from "react";
import type { Langue } from "@/lib/langue";

// US-35 : isole un texte saisi (nom, prénom, titre, taille) dans une page en arabe, pour que le sens de lecture
// ne mélange pas ses mots avec le texte autour. En français, rien n'est ajouté (même rendu qu'avant).
export default function Isole({ langue, children }: { langue: Langue; children: ReactNode }) {
  return langue === "ar" ? <bdi>{children}</bdi> : <>{children}</>;
}
