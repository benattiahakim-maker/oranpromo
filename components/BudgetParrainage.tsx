"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reglerBudgetParrainage } from "@/app/admin/parrainages/actions";
import { resumeBudget, type BudgetParrainage as Budget } from "@/lib/parrainage-admin";

// US-27.5 : budget mensuel du parrainage (en haut de /admin/parrainages et /admin/remboursements).
export default function BudgetParrainage({ budget }: { budget: Budget }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState(String(budget.budget));
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (verrou.current) return;
    verrou.current = true; setEnCours(true); setMessage("");
    try { const r = await reglerBudgetParrainage(saisie); setMessage(r.message); if (r.succes) router.refresh(); }
    finally { verrou.current = false; setEnCours(false); }
  }
  return <section aria-labelledby="budget-parrainage" className="mt-6 border border-trait p-4">
    <h2 id="budget-parrainage" className="etiquette">Budget du mois</h2>
    <p className="mt-2 text-sm">{resumeBudget(budget)}</p>
    <p className="mt-1 text-xs text-gris">Reste : {new Intl.NumberFormat("fr-FR").format(budget.restant).replace(/[\u202f\u00a0]/g, " ")} DA · Parrainage {budget.actif ? "ouvert" : "fermé (interrupteur « parrainage »)"}</p>
    <form onSubmit={e => void enregistrer(e)} className="mt-3 flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col text-xs text-gris">Budget mensuel (DA)<input inputMode="numeric" value={saisie} onChange={e => setSaisie(e.target.value)} className="mt-1 min-h-11 w-full min-w-0 border border-trait px-3 text-sm text-noir" /></label>
      <button type="submit" disabled={enCours} className="etiquette min-h-11 shrink-0 bg-noir px-4 text-blanc">Enregistrer</button>
    </form>
    <p className="mt-2 text-xs leading-[1.6] text-gris">Les bons émis comptent (pas seulement les utilisés). 0 = plus aucun nouveau bon ; les bons déjà émis restent valables.</p>
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </section>;
}
