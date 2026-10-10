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
  });
  it("avis avec réponse : « Masquer la réponse » ; « Classer » sans confirmation", async () => {
    traiterSignalementsAvis.mockResolvedValue({ succes: false, message: "Ces signalements ont changé. Actualisez la page avant de continuer." });
    render(<SignalementsAvisModeration groupes={groupes("Merci Amine")} signaux={[]} />);
    expect(screen.getByText("Masquer la réponse")).toBeTruthy();
    fireEvent.click(screen.getByText("Classer"));
    expect((await screen.findByRole("alert")).textContent).toContain("ont changé");
    expect(traiterSignalementsAvis).toHaveBeenCalledWith("v1", ["1", "2"], "classer_signalement_avis");
  });
  it("file vide et signal de fraude (jamais automatique)", () => {
    render(<SignalementsAvisModeration groupes={[]} signaux={[{ boutiqueId: "b", boutique: "Dar Lebsa", nombre: 6 }]} />);
    expect(screen.getByText("Aucun avis signalé.")).toBeTruthy();
    expect(screen.getByText("Signal (jamais automatique)")).toBeTruthy();
    expect(screen.getByText("Dar Lebsa : 6 avis 5 étoiles sur 7 jours venant de comptes de moins de 7 jours.")).toBeTruthy();
  });
});
