// Page d'accueil provisoire. Sera remplacée par la story « Accueil » (voir docs/maquettes/Main.dc.html).
export default function Accueil() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-titre text-4xl tracking-[0.3em]">ORANPROMO</h1>
      <p className="etiquette text-gris">Les promos des boutiques d&apos;Oran</p>
    </main>
  );
}
