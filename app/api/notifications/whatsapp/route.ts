import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { envoyerMessagesEnAttente, fournisseurWhatsApp } from "@/lib/notifications";

// US-20.5 : tâche planifiée d'envoi des messages WhatsApp en attente (rappels d'expiration, blocages, nouvelles tentatives).
// Appel : GET avec l'en-tête « Authorization: Bearer <CRON_SECRET> » (Vercel Cron l'ajoute tout seul).
export const runtime = "nodejs";
export const maxDuration = 60;

const reponse = (corps: object, statut: number) => Response.json(corps, { status: statut, headers: { "Cache-Control": "no-store" } });

function memeSecret(recu: string, attendu: string) {
  const a = Buffer.from(recu), b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return reponse({ message: "Tâche non configurée." }, 503);
  const recu = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? "";
  if (!memeSecret(recu, secret)) return reponse({ message: "Accès refusé." }, 401);
  const fournisseur = fournisseurWhatsApp();
  if (!fournisseur) return reponse({ message: "WhatsApp non configuré : les messages restent en attente.", envoyes: 0 }, 200);
  // Clé publique seulement : la base vérifie elle-même l'empreinte du secret (prive.reglages).
  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const resultat = await envoyerMessagesEnAttente(client, secret, fournisseur);
    return reponse(resultat, 200);
  } catch (error) {
    return reponse({ message: error instanceof Error ? error.message : "Envoi impossible." }, 500);
  }
}
