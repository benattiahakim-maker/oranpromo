"use client";
// US-23 : donne la langue et ses textes aux composants client. Seuls les textes de la langue choisie
// sont envoyés par le serveur ; sans fournisseur (tests), le français s'applique.
import { createContext, useContext, type ReactNode } from "react";
import type { Langue } from "@/lib/langue";
import { fr, type Textes } from "@/lib/textes/fr";

const Contexte = createContext<{ langue: Langue; textes: Textes }>({ langue: "fr", textes: fr });

export default function FournisseurTextes({ langue, textes, children }: { langue: Langue; textes: Textes; children: ReactNode }) {
  return <Contexte.Provider value={{ langue, textes }}>{children}</Contexte.Provider>;
}

export function useTextes(): Textes { return useContext(Contexte).textes; }
export function useLangue(): Langue { return useContext(Contexte).langue; }
