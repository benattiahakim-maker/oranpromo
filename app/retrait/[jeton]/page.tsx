import Link from "next/link";
import type { Metadata } from "next";
import { creerClientServeur } from "@/lib/supabase/server";
import { getLangue } from "@/lib/langue-serveur";
import { remplir } from "@/lib/langue";
import { textesDe } from "@/lib/textes";
import { formaterDateHeure } from "@/lib/commandes";
import { formaterPrix } from "@/lib/prix";
import { afficherTaille } from "@/lib/article";
import { lireRetraitParLien, qrCodeRetrait, type RetraitParLien } from "@/lib/retrait";
import BlocRetrait from "@/components/BlocRetrait";

// US-26.2 : page du retrait, sans connexion (lien « Envoyer à un proche » et bouton « Mon QR code » du message WhatsApp).
// Lecture seule : boutique, numéro, articles, montant, QR code et code ; jamais le nom ni le téléphone du client.
// Le jeton est dans l'adresse : pas d'indexation, pas de « Referer » vers d'autres sites.
export const metadata: Metadata = { title: "Commande à récupérer", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

function Cadre({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-lg bg-blanc pb-10 text-noir">
    <header className="flex min-h-12 items-center border-b border-trait px-4"><Link href="/" className="font-titre text-[15px] tracking-[2.5px]">ORANPROMO</Link></header>
    {children}
  </main>;
}

export default async function PageRetrait({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const langue = await getLangue();
  const t = textesDe(langue).retrait;
  let vue: RetraitParLien | null;
  try { vue = await lireRetraitParLien(await creerClientServeur(), jeton); }
  catch { return <Cadre><p role="alert" className="m-6 border border-trait p-3 text-sm">{t.impossible}</p></Cadre>; }
  if (!vue) return <Cadre><p role="status" className="m-6 border border-trait p-3 text-sm">{t.invalide}</p></Cadre>;

  const b = vue.boutique;
  const titre = remplir(t.titreProche, { n: vue.numero, boutique: b.nom });
  const etat = vue.etat === "prete" ? null : t[vue.etat];
  return <Cadre>
    <div className="px-5 pb-1.5 pt-[22px] text-center">
      <h1 className="font-titre text-[22px] font-normal leading-snug">{titre}</h1>
      {vue.etat === "prete" && vue.expire_le && <p className="mt-2 text-sm">{remplir(t.avant, { date: formaterDateHeure(vue.expire_le, langue) })}</p>}
      <p className="mt-1 text-[13px] text-gris">{[b.adresse, b.quartier].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && " · "}<bdi>{x}</bdi></span>)}{" · "}<Link href={`/b/${encodeURIComponent(b.slug)}`} className="underline">{t.voirBoutique}</Link></p>
    </div>
    {etat && <p role="status" className="mx-4 mt-4 border border-trait p-3 text-sm">{etat}</p>}
    {vue.etat === "prete" && vue.code && <div className="px-4 pt-3">
      <p className="mb-2 text-center text-sm">{t.consigneProche}</p>
      <BlocRetrait qr={await qrCodeRetrait(jeton)} code={vue.code} numero={vue.numero} total={vue.total} />
    </div>}
    <div className="px-6 pt-4">
      <ul aria-label={t.articles} className="border-t border-trait pt-3 text-[13px] font-light">{vue.lignes.map((l, i) =>
        <li key={i} className="flex justify-between gap-3 py-1"><span><bdi>{l.titre}</bdi> · <bdi>{afficherTaille(l.taille, langue)}</bdi> × {l.quantite}</span><span className="whitespace-nowrap">{formaterPrix(l.prix_unitaire * l.quantite, langue)}</span></li>)}</ul>
      <p className="flex justify-between pt-2"><span className="etiquette self-center">{t.aPayer}</span><span>{formaterPrix(vue.total, langue)}</span></p>
    </div>
  </Cadre>;
}
