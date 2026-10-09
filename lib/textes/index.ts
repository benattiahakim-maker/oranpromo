import type { Langue } from "@/lib/langue";
import { fr, type Textes } from "./fr";
import { ar } from "./ar";

export type { Textes };

/** Textes de l'interface dans la langue demandée. */
export function textesDe(langue: Langue): Textes {
  return langue === "ar" ? ar : fr;
}
