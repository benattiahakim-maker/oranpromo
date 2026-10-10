"use client";
import { COULEURS_ARTICLE, TAILLE_UNIQUE, libelleTaille, taillesPourArticle } from "@/lib/article";
import { useLangue, useTextes } from "./FournisseurTextes";
import { traduire } from "@/lib/textes";
import { traduireMessage } from "@/lib/textes/messages";

const couleurs = ["bg-[#0a0a0a]", "bg-white", "bg-[#808080]", "bg-[#d8c4a4]", "bg-[#795548]", "bg-[#172554]", "bg-[#2563eb]", "bg-[#15803d]", "bg-[#707543]", "bg-[#dc2626]", "bg-[#800020]", "bg-[#ec4899]", "bg-[#facc15]", "bg-[#f97316]", "bg-[#9333ea]", "bg-[conic-gradient(#dc2626,#facc15,#15803d,#2563eb,#9333ea,#dc2626)]"];
export function ChoixCouleur({ valeur, onChange, erreur }: { valeur: string; onChange: (v: string) => void; erreur?: string }) {
  const t = useTextes().espace.formulaire, langue = useLangue();
  return <fieldset className={`min-w-0 border p-2 ${erreur ? "border-erreur" : "border-trait"}`}><legend className="etiquette">{t.couleur}</legend><div className="grid grid-cols-2 gap-1">{COULEURS_ARTICLE.map((nom, i) => <button key={nom} type="button" name="couleur" aria-pressed={valeur === nom} onClick={() => onChange(valeur === nom ? "" : nom)} className={`flex min-h-11 items-center gap-2 border px-2 py-1 text-start text-sm ${valeur === nom ? "border-noir bg-fond-photo" : "border-transparent"}`}><span aria-hidden className={`h-5 w-5 shrink-0 border border-gris ${couleurs[i]}`} />{traduire(t.couleurs, nom)}</button>)}</div>{erreur && <p role="alert" className="text-sm text-erreur">{traduireMessage(erreur, langue)}</p>}</fieldset>;
}
export function ChoixTailles({ categorie, genre, valeurs, onChange, erreur }: { categorie: string; genre: string; valeurs: string[]; onChange: (v: string[]) => void; erreur?: string }) {
  const t = useTextes().espace.formulaire, langue = useLangue();
  return <fieldset className={`min-w-0 border p-2 ${erreur ? "border-erreur" : "border-trait"}`}><legend className="etiquette">{libelleTaille(categorie) === "Contenance" ? t.contenances : t.tailles}</legend><div className="grid grid-cols-3 gap-1">{taillesPourArticle(categorie, genre).map(x => <button key={x} type="button" name="tailles" aria-pressed={valeurs.includes(x)} onClick={() => onChange(valeurs.includes(x) ? valeurs.filter(v => v !== x) : [...valeurs, x])} className={`min-h-11 border px-2 py-2 text-sm ${valeurs.includes(x) ? "border-noir bg-noir text-blanc" : erreur ? "border-erreur" : "border-trait"}`}>{x === TAILLE_UNIQUE ? (libelleTaille(categorie) === "Contenance" ? t.unique : t.tailleUnique) : x}</button>)}</div>{!categorie && <p className="text-sm text-gris">{t.categorieDabord}</p>}{erreur && <p role="alert" className="text-sm text-erreur">{traduireMessage(erreur, langue)}</p>}</fieldset>;
}
