import type { Langue } from "@/lib/langue";
import { fr, type Textes } from "./fr";
import { ar } from "./ar";

export type { Textes };

/** Textes de l'interface dans la langue demandée. */
export function textesDe(langue: Langue): Textes {
  return langue === "ar" ? ar : fr;
}

/** Libellé traduit d'une valeur de liste fixe (catégorie, genre…) ; une valeur inconnue s'affiche telle quelle. */
export function traduire(table: Record<string, string>, valeur: string): string {
  return Object.hasOwn(table, valeur) ? table[valeur] : valeur;
}
