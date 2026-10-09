"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export default function GalerieArticle({ photos, titre }: { photos: { adresse: string; ordre: number }[]; titre: string }) {
  const galerie = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const aller = (index: number) => galerie.current?.scrollTo({ left: index * galerie.current.clientWidth, behavior: "smooth" });
  return <section aria-label={`Photos de ${titre}`}>
    <div ref={galerie} dir="ltr" tabIndex={0} aria-label="Galerie défilable" className="sans-barre-defilement flex snap-x snap-mandatory overflow-x-auto"
      onScroll={(event) => { const element = event.currentTarget; if (element.clientWidth) setActive(Math.round(element.scrollLeft / element.clientWidth)); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          aller(Math.max(0, Math.min(photos.length - 1, active + (event.key === "ArrowRight" ? 1 : -1))));
        }
      }}>
      {photos.map((photo, index) => <div key={photo.ordre} className="relative aspect-square w-full shrink-0 snap-center">
        <Image src={photo.adresse} alt={`${titre} — photo ${index + 1} sur ${photos.length}`} fill sizes="(max-width: 512px) 100vw, 512px" className="object-cover" priority={index === 0} unoptimized />
      </div>)}
    </div>
    {photos.length > 1 && <div dir="ltr" className="flex items-center justify-center gap-2">
      <button aria-label="Photo précédente" disabled={active === 0} onClick={() => aller(active - 1)} className="h-11 w-11 disabled:opacity-30">←</button>
      {photos.map((photo, index) => <button key={photo.ordre} aria-label={`Voir la photo ${index + 1}`} aria-current={active === index ? "true" : undefined} onClick={() => aller(index)} className="flex h-11 w-8 items-center justify-center"><span className={`h-px w-6 ${active === index ? "bg-noir" : "bg-gris"}`} /></button>)}
      <button aria-label="Photo suivante" disabled={active === photos.length - 1} onClick={() => aller(active + 1)} className="h-11 w-11 disabled:opacity-30">→</button>
    </div>}
    <p className="sr-only" aria-live="polite">Photo {active + 1} sur {photos.length}</p>
  </section>;
}
