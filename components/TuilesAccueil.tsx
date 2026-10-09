import Link from "next/link";
import Image from "next/image";
import type { TuileAccueil } from "@/lib/accueil";

// Tuile carrée : image de marque (couleur), mot en dessous sur fond blanc (toujours lisible).
export default function TuilesAccueil({ titre, tuiles }: { titre: string; tuiles: TuileAccueil[] }) {
  return <section aria-label={titre}>
    <h2 className="etiquette px-5 pb-4 pt-8">{titre}</h2>
    <ul className="grid grid-cols-2 gap-x-4 gap-y-5 px-5">{tuiles.map(tuile => <li key={tuile.nom} className="min-w-0">
      <Link href={tuile.lien} className="flex flex-col gap-2 text-center">
        <span className="relative block aspect-square bg-fond-photo">
          <Image src={tuile.image.adresse} alt={tuile.image.alt} fill sizes="(max-width: 512px) 45vw, 230px" className="object-cover" />
        </span>
        <span className="etiquette break-words text-[11px]">{tuile.nom}</span>
      </Link>
    </li>)}</ul>
  </section>;
}
