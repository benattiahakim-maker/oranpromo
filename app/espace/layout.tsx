import type { ReactNode } from "react";
import NavigationEspace from "@/components/NavigationEspace";
import { creerClientServeur } from "@/lib/supabase/server";
import { compterCommandesAConfirmer } from "@/lib/commandes";

async function commandesAConfirmer(): Promise<number> {
  try {
    const client = await creerClientServeur();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return 0;
    const { data: profil } = await client.from("profils").select("boutique_id").eq("id", user.id).maybeSingle();
    return profil?.boutique_id ? await compterCommandesAConfirmer(client, profil.boutique_id) : 0;
  } catch { return 0; }
}

export default async function EspaceLayout({ children }: { children: ReactNode }) {
  return <div className="font-sans [&_button]:cursor-pointer [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50 [&_select:disabled]:opacity-50 [&_input[type=checkbox]]:accent-noir"><NavigationEspace aConfirmer={await commandesAConfirmer()} />{children}</div>;
}
