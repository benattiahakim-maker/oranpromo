"use client";
import { useEffect, useRef } from "react";
import { useLangue, useTextes } from "./FournisseurTextes";
import { remplir } from "@/lib/langue";
import { traduireMessage } from "@/lib/textes/messages";
export type PhotoChoisie = { cle: string; adresse?: string; fichier?: File };
function Apercu({ photo, index }: { photo: PhotoChoisie; index: number }) {
  const image = useRef<HTMLImageElement>(null);
  const t = useTextes().espace.photos;
  useEffect(() => {
    const adresse = photo.fichier ? URL.createObjectURL(photo.fichier) : photo.adresse;
    if (image.current && adresse) image.current.src = adresse;
    return () => { if (photo.fichier && adresse) URL.revokeObjectURL(adresse); };
  }, [photo]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={remplir(t.photo, { n: index + 1 })} className="h-30 w-24 bg-fond-photo object-cover" />;
}
export default function PhotosArticle({ photos, onChange, erreur, onErreur }: { photos: PhotoChoisie[]; onChange: (v: PhotoChoisie[]) => void; erreur?: string; onErreur: (v: string) => void }) {
  const galerie = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const t = useTextes().espace.photos, langue = useLangue();
  function ajouter(input: HTMLInputElement) {
    const fichiers = Array.from(input.files ?? []); input.value = "";
    if (!fichiers.length) return;
    if (photos.length + fichiers.length > 5) { onErreur(traduireMessage("Vous pouvez ajouter au maximum 5 photos.", langue)); return; }
    if (fichiers.some(f => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || !f.size)) { onErreur(traduireMessage("Choisissez des photos JPEG, PNG ou WebP non vides.", langue)); return; }
    onChange([...photos, ...fichiers.map(fichier => ({ cle: crypto.randomUUID(), fichier }))]);
  }
  return <section aria-label={t.legende} className={`border p-2 ${erreur ? "border-erreur" : "border-trait"}`}><div className="mb-3 flex justify-between"><span className="etiquette">{t.titre}</span><span aria-live="polite" dir="ltr" className="text-sm">{photos.length} / 5</span></div><div className="flex flex-wrap gap-2">{photos.map((photo, i) => <div key={photo.cle} className="relative"><Apercu photo={photo} index={i} /><button type="button" aria-label={remplir(t.retirer, { n: i + 1 })} onClick={() => onChange(photos.filter(p => p.cle !== photo.cle))} className="absolute top-0 end-0 flex h-11 w-11 items-center justify-center border border-noir bg-blanc text-xl">×</button></div>)}</div><input ref={galerie} aria-label={t.galerie} className="hidden" type="file" accept="image/*" multiple onChange={e => ajouter(e.currentTarget)} /><input ref={camera} aria-label={t.prendre} className="hidden" type="file" accept="image/*" capture="environment" onChange={e => ajouter(e.currentTarget)} /><button type="button" name="photos" disabled={photos.length >= 5} onClick={() => galerie.current?.click()} className={`mt-3 min-h-12 w-full border bg-noir px-3 py-2 text-blanc ${erreur ? "border-erreur" : "border-noir"}`}>{t.ajouter}</button><button type="button" disabled={photos.length >= 5} onClick={() => camera.current?.click()} className="mt-2 min-h-11 w-full border border-noir px-3 py-2 text-sm sm:hidden">{t.prendre}</button>{erreur && <p role="alert" className="text-sm text-erreur">{traduireMessage(erreur, langue)}</p>}</section>;
}
