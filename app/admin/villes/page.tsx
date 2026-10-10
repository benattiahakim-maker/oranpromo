// US-29.4 : /admin/villes, réservé à l'admin. Ouvrir ou fermer une ville (confirmation en deux temps) et donner une
// ville à chaque ambassadeur. Les bornes et les nouvelles villes s'ajoutent par migration (docs/architecture.md).
import { creerClientServeur } from "@/lib/supabase/server";
import { lireRoleAdministration } from "@/lib/boutique";
import { listerAmbassadeurs, listerVillesAvecComptes, type AmbassadeurVille, type VilleAvecCompte } from "@/lib/villes-admin";
import VillesAdministration from "@/components/VillesAdministration";

export default async function Villes() {
  const client = await creerClientServeur();
  let role: string;
  try { role = await lireRoleAdministration(client); }
  catch (error) { return <main className="p-6"><p role="alert">{error instanceof Error ? error.message : "Accès réservé"}</p></main>; }
  if (role !== "admin") return <main className="p-6"><h1 className="font-titre text-[28px]">Accès réservé</h1></main>;
  let villes: VilleAvecCompte[] = [], ambassadeurs: AmbassadeurVille[] = [], erreur = "";
  try { [villes, ambassadeurs] = await Promise.all([listerVillesAvecComptes(client), listerAmbassadeurs(client)]); }
  catch (error) { erreur = error instanceof Error ? error.message : "Impossible de charger les villes. Réessayez."; }
  return <main className="p-6 text-noir">
    <h1 className="my-6 font-titre text-[40px] font-normal leading-none">Villes</h1>
    {erreur ? <p role="alert" className="my-6">{erreur}</p> : <VillesAdministration villes={villes} ambassadeurs={ambassadeurs} />}
  </main>;
}
