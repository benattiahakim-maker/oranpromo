import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/supabase/server";

export default async function Espace({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const supabase = await creerClientServeur();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/espace/connexion");
  const { erreur } = await searchParams;

  async function deconnecter() {
    "use server";
    const client = await creerClientServeur();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) redirect("/espace?erreur=deconnexion");
    redirect("/espace/connexion");
  }

  return <main style={{ width: "100%", maxWidth: 390, margin: "0 auto", boxSizing: "border-box", padding: 24 }}>
    <h1 style={{ fontFamily: "var(--font-bodoni), serif", fontSize: 30, fontWeight: 400, margin: "24px 0" }}>Mon espace</h1>
    <p style={{ overflowWrap: "anywhere", fontSize: 16 }}>Connecté : {user.email}</p>
    {erreur === "deconnexion" && <p role="alert" style={{ fontSize: 14 }}>Impossible de vous déconnecter. Réessayez.</p>}
    <form action={deconnecter}><button type="submit" style={{ width: "100%", minHeight: 54, marginTop: 24, border: 0, borderRadius: 0, background: "#0A0A0A", color: "#FFFFFF", font: "inherit", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>Se déconnecter</button></form>
  </main>;
}
