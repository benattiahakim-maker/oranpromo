import Link from "next/link";
import LienPanier from "./LienPanier";

export default function EntetePublic() {
  return <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 border-b border-trait px-5 py-5"><Link href="/" className="font-titre text-xl tracking-[0.2em]">ORANPROMO</Link><nav aria-label="Navigation du site" className="flex items-center gap-4"><Link href="/catalogue" className="etiquette inline-flex min-h-11 items-center">Rechercher</Link><LienPanier /></nav></header>;
}
