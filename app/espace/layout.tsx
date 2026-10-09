import type { ReactNode } from "react";
import NavigationEspace from "@/components/NavigationEspace";

export default function EspaceLayout({ children }: { children: ReactNode }) {
  return <div className="font-sans [&_button]:cursor-pointer [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50 [&_select:disabled]:opacity-50 [&_input[type=checkbox]]:accent-noir"><NavigationEspace />{children}</div>;
}
