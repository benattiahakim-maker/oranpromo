import Link from "next/link";

export default function EntetePublic() {
  return <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 border-b border-trait px-5 py-5"><Link href="/" className="font-titre text-xl tracking-[0.2em]">ORANPROMO</Link><Link href="/catalogue" className="etiquette inline-flex min-h-11 items-center">Rechercher</Link></header>;
}
