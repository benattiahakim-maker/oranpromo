import Link from "next/link";
import type { Textes } from "@/lib/textes";
import ChoixParrain from "./ChoixParrain";
import PartageParrainage, { type LienInvitation } from "./PartageParrainage";

/** Ce que la page /parrainage sait du visiteur (calculé par app/parrainage/page.tsx). */
export type VueParrainage = {
  ouvert: boolean;
  invite: boolean;
  /** anonyme : pas connecté ; client : peut parrainer ; autre : connecté sans numéro vérifié, commerçant… */
  visiteur: "anonyme" | "client" | "autre";
  invitation: LienInvitation | null;
  choix: { initial: string; parrainSaisi: boolean; saisies: number } | null;
};

// US-27.3 : page publique « Parraine tes amis » (texte et rendu seulement ; données lues par la page).
export default function ContenuParrainage({ t, vue }: { t: Textes["parrainage"]; vue: VueParrainage }) {
  const regles = [t.regle1, t.regle2, t.regle3, t.regle4, t.regle5, t.regle6, t.regle7];
  return <main className="mx-auto w-full max-w-lg bg-blanc pb-10 text-noir">
    {vue.invite && <p role="status" className="border-b border-noir bg-noir px-6 py-3 text-center text-sm text-blanc">{t.invite}</p>}
    <header className="border-b border-trait px-6 pb-5 pt-6 text-center">
      <p className="etiquette text-gris">{t.etiquette}</p>
      <h1 className="font-titre text-[32px] font-normal">{t.titre}</h1>
      <p className="mt-2 text-sm leading-[1.7]">{t.intro}</p>
    </header>
    {!vue.ouvert && !vue.invitation ? <p role="status" className="m-6 border border-trait p-4 text-center text-sm">{t.ferme}</p> : <>
      <section aria-labelledby="titre-etapes" className="px-6 pt-6">
        <h2 id="titre-etapes" className="etiquette border-b border-trait pb-2 text-xs text-gris">{t.commentCaMarche}</h2>
        <ol>{[t.etape1, t.etape2, t.etape3].map((etape, i) => <li key={i} className="flex items-start gap-4 border-b border-trait py-4">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center border border-noir font-titre text-lg">{i + 1}</span>
          <span className="pt-1.5 text-sm leading-[1.6]">{etape}</span></li>)}</ol>
        <p className="pt-4 text-[15px] font-medium">{t.recompense}</p>
      </section>
      {vue.choix && <div className="px-6"><ChoixParrain initial={vue.choix.initial} parrainSaisi={vue.choix.parrainSaisi} saisies={vue.choix.saisies} /></div>}
      <div className="px-6 pt-6">
        {vue.invitation ? <PartageParrainage invitation={vue.invitation} />
          : vue.visiteur === "anonyme" ? <div className="border border-noir p-4 text-center">
            <p className="text-sm">{vue.invite ? t.inviteConnexion : t.connecteToi}</p>
            <Link href="/compte/connexion?suite=/compte" className="etiquette mt-3 flex min-h-12 items-center justify-center bg-noir text-blanc">{t.seConnecter}</Link>
          </div>
          : !vue.choix && <p className="border border-trait p-4 text-sm">{t.reserveClients}</p>}
      </div>
      <section aria-labelledby="titre-bon" className="px-6 pt-8">
        <h2 id="titre-bon" className="etiquette text-xs text-gris">{t.bonTitre}</h2>
        <p className="mt-2 text-sm leading-[1.7]">{t.bonTexte}</p>
        {vue.visiteur !== "anonyme" && <Link href="/compte" className="etiquette mt-4 flex min-h-12 items-center justify-center border border-noir">{t.voirMesBons}</Link>}
      </section>
    </>}
    <section aria-labelledby="titre-regles" className="px-6 pt-8">
      <h2 id="titre-regles" className="etiquette text-xs text-gris">{t.reglesTitre}</h2>
      <ul className="mt-2 list-disc ps-5 text-[13px] leading-[1.7]">{regles.map((r, i) => <li key={i}>{r}</li>)}</ul>
    </section>
  </main>;
}
