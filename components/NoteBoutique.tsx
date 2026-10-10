// US-32.3 : note d'une boutique (« ★ 4,6 · 18 avis », « Pas encore assez d'avis » sous le seuil de 3 avis publiés).
// Sans état ni crochet : utilisable dans les pages serveur et les composants client.
import { formaterMoyenne, type ResumeAvis } from "@/lib/avis";
import { remplir } from "@/lib/langue";
import type { Textes } from "@/lib/textes";

type Props = { resume: Pick<ResumeAvis, "nombre" | "moyenne"> | null | undefined; t: Textes["avis"]; forme?: "vitrine" | "fiche"; className?: string };

/** Texte de la note, ou null quand rien n'est à afficher (fiche sous le seuil, résumé illisible). */
export function texteNote({ resume, t, forme = "vitrine" }: Omit<Props, "className">): string | null {
  if (!resume) return null;
  if (resume.moyenne === null) return forme === "fiche" ? null : t.pasAssez;
  return remplir(forme === "fiche" ? t.resumeFiche : t.resume, { note: formaterMoyenne(resume.moyenne), n: resume.nombre });
}

export default function NoteBoutique({ className, ...props }: Props) {
  const texte = texteNote(props);
  return texte ? <span className={className} dir="auto">{texte}</span> : null;
}
