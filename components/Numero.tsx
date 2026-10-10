import { Fragment, type ReactNode } from "react";
import { telephoneLisible } from "@/lib/clients";

// Numéro de téléphone (client, WhatsApp de boutique…) isolé de gauche à droite : dans une page en arabe (dir="rtl"),
// « +213 5… » ne devient pas « 213 5…+ » et les chiffres restent dans l'ordre. À utiliser partout où un numéro s'affiche.
export default function Numero({ telephone, lisible = false, className }: { telephone: string; lisible?: boolean; className?: string }) {
  return <bdi dir="ltr" data-numero="" className={className}>{lisible ? telephoneLisible(telephone) : telephone}</bdi>;
}

// Comme `remplir`, mais une valeur peut être un élément (par exemple <Numero />) : « {numero} · vérifié le {date} ».
export function remplirAvec(modele: string, valeurs: Record<string, ReactNode>): ReactNode {
  return modele.split(/(\{[a-zA-Z]+\})/).map((morceau, i) => {
    const cle = /^\{([a-zA-Z]+)\}$/.exec(morceau)?.[1];
    return <Fragment key={i}>{cle !== undefined && cle in valeurs ? valeurs[cle] : morceau}</Fragment>;
  });
}
