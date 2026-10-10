// US-31.5 : écrans de l'alerte WhatsApp (vitrine après « Suivre », /compte/boutiques, page du lien).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import FournisseurTextes from "./FournisseurTextes";
import BoutonSuivre from "./BoutonSuivre";
import AlertesCompte from "./AlertesCompte";
import NePlusRecevoir from "./NePlusRecevoir";
import { fr } from "@/lib/textes/fr";
import { ar } from "@/lib/textes/ar";

const actions = vi.hoisted(() => ({ suivreBoutique: vi.fn(), activerAlertes: vi.fn(), desactiverAlertes: vi.fn(), nePlusRecevoir: vi.fn() }));
vi.mock("@/app/compte/boutiques/actions", () => ({ suivreBoutique: actions.suivreBoutique, activerAlertes: actions.activerAlertes, desactiverAlertes: actions.desactiverAlertes,
  nePlusSuivre: vi.fn(), seConnecterPourSuivre: vi.fn(), suivreApresConnexion: vi.fn(), rattacherInscription: vi.fn() }));
vi.mock("@/app/alertes/[jeton]/actions", () => ({ nePlusRecevoir: actions.nePlusRecevoir }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); actions.suivreBoutique.mockResolvedValue({ succes: true, suivie: true }); });

const vitrine = (alertes?: { proposees: boolean; actives: boolean }, textes = fr, langue: "fr" | "ar" = "fr") => render(<FournisseurTextes langue={langue} textes={textes}>
  <BoutonSuivre boutiqueId="11111111-1111-4111-8111-111111111111" slug="nour" nom="Boutique Nour" connecte suivieAuDepart={false} apresConnexion={null} alertes={alertes} /></FournisseurTextes>);

describe("vitrine : alerte proposée à part après « Suivre » (écran ②)", () => {
  it("éteintes (par défaut) : rien après « Suivre »", async () => {
    vitrine();
    fireEvent.click(screen.getByRole("button", { name: "Suivre" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "✓ Suivie" })).toBeInTheDocument());
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("déjà actives : rien à proposer", async () => {
    vitrine({ proposees: true, actives: true });
    fireEvent.click(screen.getByRole("button", { name: "Suivre" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "✓ Suivie" })).toBeInTheDocument());
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
  it("proposées : case NON cochée ; « Enregistrer » sans la case n'enregistre rien (suivre ne vaut pas accord)", async () => {
    vitrine({ proposees: true, actives: false });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument(); // pas avant « Suivre »
    fireEvent.click(screen.getByRole("button", { name: "Suivre" }));
    const caseAccord = await screen.findByRole("checkbox", { name: fr.alertes.caseAccord });
    expect(caseAccord).not.toBeChecked();
    expect(screen.getByText("Vous suivez Boutique Nour. Retrouvez-la dans votre compte, « Mes boutiques ».")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("C’est noté : pas d’alerte WhatsApp.");
    expect(actions.activerAlertes).not.toHaveBeenCalled();
  });
  it("case cochée puis « Enregistrer » : accord enregistré (source vitrine)", async () => {
    actions.activerAlertes.mockResolvedValue({ succes: true, actives: true });
    vitrine({ proposees: true, actives: false });
    fireEvent.click(screen.getByRole("button", { name: "Suivre" }));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Alertes WhatsApp activées : un message par jour au plus");
    expect(actions.activerAlertes).toHaveBeenCalledWith("vitrine");
  });
  it("refus de la base : message d'erreur", async () => {
    actions.activerAlertes.mockResolvedValue({ succes: false, actives: false, erreur: "nonProposees" });
    vitrine({ proposees: true, actives: false });
    fireEvent.click(screen.getByRole("button", { name: "Suivre" }));
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Les alertes WhatsApp ne sont pas encore proposées.");
  });
  it("en arabe : texte n° 9 du module 17", async () => {
    vitrine({ proposees: true, actives: false }, ar, "ar");
    fireEvent.click(screen.getByRole("button", { name: "تبّع" }));
    expect(await screen.findByRole("checkbox", { name: ar.alertes.caseAccord })).not.toBeChecked();
  });
});

describe("/compte/boutiques : bloc « Alertes WhatsApp » (écran ④)", () => {
  it("désactivées : texte de l'accord puis « Activer »", async () => {
    actions.activerAlertes.mockResolvedValue({ succes: true, actives: true });
    render(<AlertesCompte activesAuDepart={false} proposees />);
    expect(screen.getByRole("status")).toHaveTextContent("Désactivées.");
    expect(screen.getByText(fr.alertes.caseAccord)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activer" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Activées : un message par jour au plus."));
    expect(actions.activerAlertes).toHaveBeenCalledWith("compte");
  });
  it("actives : « Désactiver », même si les alertes ne sont plus proposées", async () => {
    actions.desactiverAlertes.mockResolvedValue({ succes: true, actives: false });
    render(<AlertesCompte activesAuDepart proposees={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Désactiver" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Désactivées."));
    expect(screen.queryByRole("button", { name: "Activer" })).not.toBeInTheDocument();
  });
});

describe("page du lien : « Ne plus recevoir » (écran ⑨)", () => {
  const JETON = "0123456789abcdef".repeat(3);
  it("bouton → « Vous ne recevrez plus d'alertes. Vous suivez toujours vos boutiques. »", async () => {
    actions.nePlusRecevoir.mockResolvedValue("desactivees");
    render(<NePlusRecevoir jeton={JETON} dejaFait={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Ne plus recevoir" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Vous ne recevrez plus d’alertes.Vous suivez toujours vos boutiques.");
    expect(actions.nePlusRecevoir).toHaveBeenCalledWith(JETON);
  });
  it("lien invalide : message ; en arabe : texte n° 10", async () => {
    actions.nePlusRecevoir.mockResolvedValue("invalide");
    render(<NePlusRecevoir jeton={JETON} dejaFait={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Ne plus recevoir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ce lien n’est pas valide.");
    cleanup();
    render(<FournisseurTextes langue="ar" textes={ar}><NePlusRecevoir jeton={JETON} dejaFait /></FournisseurTextes>);
    expect(screen.getByRole("status")).toHaveTextContent("ما عادش يجيوك الميساجات.");
  });
});
