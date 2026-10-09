import Link from "next/link";
import ConnexionEmail from "@/components/ConnexionEmail";

export default async function Connexion({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return <main style={{ width: "100%", maxWidth: 390, margin: "0 auto", boxSizing: "border-box", padding: "24px", color: "#0A0A0A", background: "#FFFFFF" }}>
    <Link href="/" style={{ display: "block", textAlign: "center", fontFamily: "var(--font-bodoni), serif", fontSize: 22, letterSpacing: 5, textDecoration: "none", color: "inherit", padding: "12px 0 32px" }}>ORANPROMO</Link>
    <h1 style={{ fontFamily: "var(--font-bodoni), serif", fontSize: 30, fontWeight: 400, textAlign: "center", margin: "16px 0" }}>Se connecter</h1>
    <p style={{ fontSize: 14, color: "#6F6F6F", textAlign: "center", marginBottom: 32 }}>Votre espace commerçant</p>
    {erreur === "lien" && <p role="alert" style={{ border: "1px solid #E6E6E6", padding: 16, fontSize: 14, lineHeight: 1.6 }}>Ce lien de connexion est invalide, expiré ou déjà utilisé. Demandez un nouveau lien.</p>}
    <ConnexionEmail />
  </main>;
}
