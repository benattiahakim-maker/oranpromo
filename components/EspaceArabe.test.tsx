// US-35 : espace commerçant en arabe (textes de docs/textes-espace-ar.md, à valider par le propriétaire).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import FournisseurTextes from "./FournisseurTextes";
import NavigationEspace from "./NavigationEspace";
import CommandesRecues from "./CommandesRecues";
import MesArticles from "./MesArticles";
import AccepterConditionsCommercant, { RESUME_CONDITIONS_COMMERCANTS } from "./AccepterConditionsCommercant";
import VueCommandesRecues from "./VueCommandesRecues";
import { textesDe } from "@/lib/textes";
import type { CommandeRecue } from "@/lib/commandes";
import type { ArticleGere } from "@/lib/gestion-articles";

vi.mock("next/navigation", () => ({ usePathname: () => "/espace", useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/espace/actions", () => ({ deconnecter: vi.fn() }));
vi.mock("@/app/langue/actions", () => ({ choisirLangue: vi.fn() }));
vi.mock("@/app/espace/commandes/actions", () => ({ changerStatutCommandeBoutique: vi.fn(), declarerClientPasVenu: vi.fn(), changerStatutCommandesBoutique: vi.fn() }));
vi.mock("@/app/espace/conditions/actions", () => ({ accepterConditionsEspace: vi.fn() }));
afterEach(cleanup);

const ar = textesDe("ar"), t = ar.espace;
const enArabe = (enfant: ReactNode) => render(<FournisseurTextes langue="ar" textes={ar}>{enfant}</FournisseurTextes>);
const commande = (statut: CommandeRecue["statut"]): CommandeRecue => ({ id: `c-${statut}`, numero: 15, client_id: "k", boutique_id: "b1", statut, client_nom: "Samia B.", client_telephone: "+213555123456", note: "Samedi", motif_annulation: null, total: 8700, cree_le: "2026-10-09T12:05:00Z", confirmee_le: null, prete_le: null, expire_le: null, terminee_le: null, no_show_le: null, no_show_annule_le: null, contestee_le: null, contestation_validee_le: null, telephone_verifie: false, langue: "fr", mode_remise: null, bon_id: null, remise_bon: 0, lignes_commande: [{ id: "l1", commande_id: `c-${statut}`, article_id: "a", titre: "Polo", taille: "M", quantite: 2, prix_unitaire: 3500 }] } as CommandeRecue);

describe("US-35 : espace commerçant en arabe", () => {
  it("navigation en arabe, avec le choix de la langue (vers le français)", () => {
    enArabe(<NavigationEspace aConfirmer={2} avisSansReponse={1} />);
    const nav = screen.getByRole("navigation", { name: t.nav.titre });
    expect(within(nav).getByRole("link", { name: `${t.nav.commandes} (2)` })).toHaveAttribute("href", "/espace/commandes");
    expect(within(nav).getByRole("link", { name: t.nav.avisSansReponse.replace("{n}", "1") })).toHaveAttribute("href", "/espace/avis");
    expect(within(nav).getByRole("button", { name: t.nav.deconnecter })).toBeInTheDocument();
    const langue = within(nav).getByRole("button", { name: ar.langue.autreNom });
    expect(langue).toHaveAttribute("value", "fr"); expect(langue).toHaveAttribute("lang", "fr");
    expect(nav.textContent).not.toMatch(/Mes articles|Commandes|Se déconnecter/);
  });

  it("carte de commande : statut, boutons et prix en arabe (chiffres latins isolés, « دج »)", () => {
    enArabe(<CommandesRecues commandes={[commande("demandee")]} boutique="Boutique Amine" />);
    expect(screen.getByText(ar.commandes.statuts.demandee)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.carte.actions.confirmee })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.commun.annuler })).toBeInTheDocument();
    const article = screen.getByRole("article", { name: t.carte.commande.replace("{n}", "15") });
    expect(article.textContent).toContain("دج"); expect(article.textContent).not.toContain("DA");
    expect(article.textContent).toContain(t.carte.pieces.replace("{n}", "2"));
    expect(article.querySelector("bdi")?.textContent).toBe("Samia B.");
  });

  it("mes articles : statuts traduits, valeurs inchangées", () => {
    const article = { id: "a1", boutique_id: "b1", titre: "Robe fleurie", prix: 4500, statut: "disponible", masque_par_moderation: false, photos: [], tailles: [{ id: "t1", article_id: "a1", libelle: "M", quantite: 0, disponible: true }], promos: null } as unknown as ArticleGere;
    enArabe(<MesArticles articles={[article]} />);
    const statut = screen.getByRole("combobox", { name: t.articles.statutDe.replace("{titre}", "Robe fleurie") });
    expect(within(statut).getByRole("option", { name: t.articles.statuts.vendu })).toHaveAttribute("value", "vendu");
    expect(screen.getByText(t.articles.stock)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.articles.plus.replace("{taille}", "M") })).toBeInTheDocument();
  });

  it("conditions : écran et résumé des engagements en arabe ; avis « texte officiel en français » (texte entier non traduit)", () => {
    enArabe(<AccepterConditionsCommercant documents={[{ document: "conditions_commercants", version: "2026-10-10" }]} />);
    expect(screen.getByRole("heading", { name: t.conditions.titre })).toBeInTheDocument();
    expect(screen.getAllByRole("note")[0]).toHaveTextContent(t.conditions.francais);
    const points = screen.getAllByRole("listitem").map(li => li.textContent);
    expect(points).toEqual([t.conditions.resume1, t.conditions.resume2, t.conditions.resume3, t.conditions.resume4, t.conditions.resume5]);
    for (const point of points) expect(point).toMatch(/[\u0600-\u06FF]/);
    // plus de bloc forcé en français : le résumé suit la page (droite à gauche)
    expect(screen.getAllByRole("listitem")[0].closest("[dir]")).toBeNull();
    expect(screen.queryByText(RESUME_CONDITIONS_COMMERCANTS[0])).toBeNull();
    expect(screen.getByRole("link", { name: t.conditions.lire })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.conditions.accepter })).toBeDisabled();
  });

  it("commandes reçues (rendu serveur) : titre, étapes et recherche en arabe", () => {
    render(<VueCommandesRecues boutiqueId="b1" boutique="Boutique" maintenant={Date.parse("2026-10-09T13:00:00Z")} recherche={false} texteRecherche="" compteurs={{ a_confirmer: 0, a_preparer: 0, pretes: 0, terminees: 0 }} etape="a_confirmer" commandes={[]} erreur={false} langue="ar" />);
    expect(screen.getByRole("heading", { name: t.commandes.titre })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: t.commandes.etapesLibelle }).textContent).toContain(t.commandes.etapes.a_preparer.libelle);
    expect(screen.getByPlaceholderText(t.commandes.recherche)).toBeInTheDocument();
  });
});
