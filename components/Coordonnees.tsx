import { formaterPosition, type Position } from "@/lib/position";

// Coordonnées « 35,697120 · −0,633750 » isolées de gauche à droite (comme <Numero />) : dans une page en arabe
// (dir="rtl"), la latitude reste à gauche de la longitude et le « − » reste collé devant son nombre.
export default function Coordonnees({ position, className, testId }: { position: Position; className?: string; testId?: string }) {
  return <bdi dir="ltr" data-coordonnees="" data-testid={testId} className={className}>{formaterPosition(position)}</bdi>;
}
