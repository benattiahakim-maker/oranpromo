import type { ReactNode } from "react";
import EntetePublic from "@/components/EntetePublic";
import NavigationCompte from "@/components/NavigationCompte";

export default function CompteLayout({ children }: { children: ReactNode }) {
  return <div className="font-sans [&_button]:cursor-pointer [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50"><EntetePublic /><NavigationCompte />{children}</div>;
}
