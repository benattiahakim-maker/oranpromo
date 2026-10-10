import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignalementsAvisModeration from "./SignalementsAvisModeration";
import { regrouperSignalementsAvis, type SignalementAvisModeration } from "@/lib/moderation";

const { traiterSignalementsAvis, refresh } = vi.hoisted(() => ({ traiterSignalementsAvis: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/moderation/actions", () => ({ traiterSignalementsAvis }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const avis = (reponse: string | null = null) => ({ id: "v1", note: 5, commentaire: "Très bon accueil…", reponse, reponse_masquee: false, statut: "publie", cree_le: "2026-10-08T10:00:00Z", boutiques: { nom: "Boutique Nour" }, profils: { nom: "Amine Benali" } });
const groupes = (reponse: string | null = null) => regrouperSignalementsAvis(["1", "2"].map(id => ({ id, avis_id: "v1", motif: "faux_avis", commentaire: null, statut: "ouvert", cree_le: "2026-10-09T10:00:00Z", avis: avis(reponse) }) as SignalementAvisModeration));

describe("US-32.4 : onglet Avis de la modération", () => {
  it("affiche la boutique, la note, l'auteur, l'avis et « 2 signalements : Faux avis » (maquette ⑧)", () => {
    render(<SignalementsAvisModeration groupes={groupes()} signaux={[]} />);
    expect(screen.getByText("Boutique Nour")).toBeTruthy();
    expect(screen.getByText(/Amine B\. · 8\/10/)).toBeTruthy();
    expect(screen.getByText("« Très bon accueil… »")).toBeTruthy();
    expect(screen.getByText("2 signalements : Faux avis")).toBeTruthy();
    expect(screen.queryByText("Masquer la réponse")).toBeNull();
  });
  it("masquer l'avis : confirmation puis une décision pour les signalements vus", async () => {
    traiterSignalementsAvis.mockResolvedValue({ succes: true, message: "Décisions enregistrées." });
    render(<SignalementsAvisModeration groupes={groupes()} signaux={[]} />);
    fireEvent.click(screen.getByText("Masquer l’avis"));
    expect(traiterSignalementsAvis).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirmer"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Décisions enregistrées."));
    expect(traiterSignalementsAvis).toHaveBeenCalledWith("v1", ["1", "2"], "masquer_avis");
    expect(screen.queryByText("Classer")).toBeNull();
    // La confirmation reste affichée : pas d'actualisation qui retirerait l'avis traité de la liste.
    expect(refresh).not.toHaveBeenCalled();
  });
  it("avis avec réponse : « Masquer la réponse » ; « Classer » sans confirmation", async () => {
    traiterSignalementsAvis.mockResolvedValue({ succes: false, message: "Ces signalements ont changé. Actualisez la page avant de continuer." });
    render(<SignalementsAvisModeration groupes={groupes("Merci Amine")} signaux={[]} />);
    expect(screen.getByText("Masquer la réponse")).toBeTruthy();
    fireEvent.click(screen.getByText("Classer"));
    expect((await screen.findByRole("alert")).textContent).toContain("ont changé");
    expect(traiterSignalementsAvis).toHaveBeenCalledWith("v1", ["1", "2"], "classer_signalement_avis");
    expect(refresh).toHaveBeenCalled();
  });
  it("file vide et les 4 signaux de fraude (jamais automatiques, aucun bouton d'action)", () => {
    render(<SignalementsAvisModeration groupes={[]} signaux={[
      { signal: "comptes_recents", boutiqueId: "b", boutique: "Dar Lebsa", nombre: 6, detail: null },
      { signal: "avis_groupes", boutiqueId: "b", boutique: "Dar Lebsa", nombre: 3, detail: "08/10 14:32" },
      { signal: "meme_numero", boutiqueId: "n", boutique: "Boutique Nour", nombre: 4, detail: "+213 … 56" },
      { signal: "retraits_rapides", boutiqueId: "n", boutique: "Boutique Nour", nombre: 5, detail: null },
    ]} />);
    expect(screen.getByText("Aucun avis signalé.")).toBeTruthy();
    expect(screen.getByText("Signaux (jamais automatiques)")).toBeTruthy();
    expect(screen.getByText(/rien n’est masqué ni bloqué automatiquement/)).toBeTruthy();
    expect(screen.getByText("Dar Lebsa : 6 avis 5 étoiles sur 7 jours venant de comptes de moins de 7 jours.")).toBeTruthy();
    expect(screen.getByText("Dar Lebsa : 3 avis dans la même minute (08/10 14:32).")).toBeTruthy();
    expect(screen.getByText("Boutique Nour : le numéro +213 … 56 a donné 4 avis, tous à cette boutique (30 jours).")).toBeTruthy();
    expect(screen.getByText("Boutique Nour : 5 commandes récupérées moins de 30 minutes après la commande (30 jours).")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
