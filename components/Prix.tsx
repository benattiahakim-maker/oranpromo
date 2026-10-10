import type { Langue } from "@/lib/langue";
import { chiffresPrix, formaterPrix } from "@/lib/prix";

// Prix isolé du texte autour, à utiliser partout où un prix s'affiche. Le site entier passe en dir="rtl" en arabe,
// espace et admin compris : sans isolement, « 3 500 DA » devenait « DA 3 500 » et « −500 DA » « DA 500− ».
// Français : de gauche à droite. Arabe : de droite à gauche (« دج » à gauche du nombre), chiffres et signe isolés
// de gauche à droite. `moins` : montant retiré (bon), « −500 DA ».
export default function Prix({ montant, langue = "fr", moins = false, className }: { montant: number; langue?: Langue; moins?: boolean; className?: string }) {
  const texte = langue === "ar"
    ? (moins ? `\u2066−${chiffresPrix(montant)}\u2069\u00a0دج` : formaterPrix(montant, "ar"))
    : `${moins ? "−" : ""}${formaterPrix(montant)}`;
  return <bdi dir={langue === "ar" ? "rtl" : "ltr"} data-prix="" className={className}>{texte}</bdi>;
}
