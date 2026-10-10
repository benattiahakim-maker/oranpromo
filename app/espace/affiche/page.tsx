import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import BoutonImprimer from "@/components/BoutonImprimer";
import { creerClientServeur } from "@/lib/supabase/server";
import { adresseDonneesSvg, preparerPartageBoutique, qrCodeSvg } from "@/lib/lien-boutique";
import { lienInscription } from "@/lib/inscription-boutique";
import { villeLue } from "@/lib/ville";

export const metadata: Metadata = { title: "Affiche de ma boutique", robots: { index: false, follow: false } };

// US-22 : affiche A4 à imprimer et à poser en boutique.
// US-31.3 : le QR code mène à /i/<slug> (vitrine + inscription : le client qui crée son compte suit la boutique).
export default async function Affiche() {
  const supabase = await creerClientServeur();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/espace/connexion");
  const { data: profil } = await supabase.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
  const { data: boutique } = profil?.boutique_id ? await supabase.from("boutiques").select("nom, slug, statut, villes(nom)").eq("id", profil.boutique_id).maybeSingle() : { data: null };
  // US-30.1 : « BleDeal · <ville de la boutique> » (Oran si illisible).
  const partage = boutique ? await preparerPartageBoutique({ ...boutique, ville: villeLue(boutique.villes)?.nom }) : null;
  // US-35 : l'affiche imprimée pour les clients reste en français (sens gauche-droite), même si l'espace est en arabe.
  if (!partage?.qrCode) return <main dir="ltr" lang="fr" className="mx-auto w-full max-w-[390px] px-6 py-10 text-center">
    <h1 className="font-titre text-[28px]">Affiche de ma boutique</h1>
    <p role="alert" className="mt-4 text-sm">{!boutique ? "Votre compte n’est rattaché à aucune boutique." : "L’affiche sera disponible dès que votre boutique sera validée par BleDeal."}</p>
    <Link href="/espace" className="etiquette mt-6 flex min-h-11 items-center justify-center border border-noir">Retour à mon espace</Link>
  </main>;
  const lien = lienInscription(partage.slug);
  const qrCode = adresseDonneesSvg(await qrCodeSvg(lien));
  return <main dir="ltr" lang="fr" className="mx-auto flex w-full max-w-[390px] flex-col items-center px-6 py-8 text-center print:max-w-none print:py-0">
    <style>{"@page { size: A4; margin: 18mm; }"}</style>
    <section aria-label="Affiche" className="flex w-full flex-col items-center border border-noir px-6 py-10 print:min-h-[250mm] print:justify-center print:border-2">
      <p className="etiquette text-gris">BleDeal · {partage.ville}</p>
      <h1 className="font-titre mt-4 break-words text-[32px] leading-tight print:text-[48px]">{partage.nom}</h1>
      <p className="mt-6 text-base print:text-2xl">Scannez pour voir nos articles et nos promos</p>
      <p className="mt-2 text-sm print:text-xl">Inscrivez-vous et suivez la boutique</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré localement (adresse data:) */}
      <img src={qrCode} alt={`QR code du lien de ${partage.nom}`} width={260} height={260} className="mt-6 h-[260px] w-[260px] print:h-[110mm] print:w-[110mm]" />
      <p className="mt-6 break-all text-sm print:text-xl">{lien}</p>
      <p className="etiquette mt-6 text-gris">Réservez sur WhatsApp · Payez en boutique</p>
    </section>
    <div className="mt-6 w-full print:hidden"><BoutonImprimer /><Link href="/espace" className="etiquette mt-3 flex min-h-11 items-center justify-center border border-noir">Retour à mon espace</Link></div>
  </main>;
}
