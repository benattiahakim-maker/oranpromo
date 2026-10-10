// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProprietesCartePosition } from "./CartePosition";
import PositionEspace from "./PositionEspace";
import BoutiquesAdministration from "./BoutiquesAdministration";
import type { Tables } from "@/lib/supabase/types";

const { enregistrerPositionMaBoutique, modifierPositionBoutique, refresh } = vi.hoisted(() => ({ enregistrerPositionMaBoutique: vi.fn(), modifierPositionBoutique: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/espace/actions", () => ({ enregistrerPositionMaBoutique }));
vi.mock("@/app/admin/boutiques/actions", () => ({ modifierPositionBoutique, modifierStatutBoutique: vi.fn(), rattacherCompteBoutique: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/dynamic", () => ({
  default: () => function FausseCarte(props: ProprietesCartePosition) {
    return <div data-testid="carte" data-deplacable={String(props.deplacable)}><button type="button" onClick={() => props.onDeplacer?.({ latitude: 35.7034, longitude: -0.6436 })}>Déplacer l’épingle</button></div>;
  },
}));
beforeEach(() => { vi.clearAllMocks(); enregistrerPositionMaBoutique.mockResolvedValue({ succes: true, message: "Position enregistrée." }); modifierPositionBoutique.mockResolvedValue({ succes: true, message: "Position enregistrée." }); });
afterEach(cleanup);

describe("US-24.2 : /espace, bloc « Position sur la carte »", () => {
  it("boutique en attente : le commerçant place l'épingle et enregistre deux nombres", async () => {
    render(<PositionEspace statut="en_attente" latitude={null} longitude={null} />);
    expect(screen.getByText("Réglez-la avant la validation : ensuite, seul OranPromo pourra la changer.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Déplacer l’épingle" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la position" }));
    await waitFor(() => expect(enregistrerPositionMaBoutique).toHaveBeenCalledWith(35.7034, -0.6436));
    expect(await screen.findByText("Position enregistrée.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("boutique en attente : retirer la position envoie deux null", async () => {
    render(<PositionEspace statut="en_attente" latitude={35.7303} longitude={-0.5784} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer la position" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la position" }));
    await waitFor(() => expect(enregistrerPositionMaBoutique).toHaveBeenCalledWith(null, null));
  });

  it("refus du serveur affiché", async () => {
    enregistrerPositionMaBoutique.mockResolvedValue({ succes: false, message: "Pour déplacer votre boutique sur la carte, contactez OranPromo." });
    render(<PositionEspace statut="en_attente" latitude={35.7303} longitude={-0.5784} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la position" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("contactez OranPromo");
  });

  it("US-29.4 : ville affichée (Oran par défaut) et bornes de la ville de la boutique", () => {
    render(<PositionEspace statut="en_attente" latitude={null} longitude={null} />); expect(screen.getByText("Ville : Oran")).toBeInTheDocument(); cleanup();
    const tlemcen = { nom: "Tlemcen", lat_min: 34.08, lat_max: 35.25, lng_min: -2.23, lng_max: -0.75, centre_lat: 34.8818, centre_lng: -1.3167 };
    render(<PositionEspace statut="en_attente" latitude={null} longitude={null} zone={tlemcen} />); expect(screen.getByText("Ville : Tlemcen")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "35,6971" } }); fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "-0,6337" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la position" }));
    expect(screen.getByRole("alert")).toHaveTextContent("La position doit être dans la wilaya de Tlemcen."); expect(enregistrerPositionMaBoutique).not.toHaveBeenCalled();
  });

  it("une seule coordonnée saisie à la main : refusée à l'écran, rien d'envoyé", () => {
    render(<PositionEspace statut="en_attente" latitude={null} longitude={null} />);
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "35,73" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la position" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Saisissez la latitude et la longitude, ou aucune des deux.");
    expect(enregistrerPositionMaBoutique).not.toHaveBeenCalled();
  });

  it.each(["validee", "suspendue"] as const)("boutique %s : lecture seule, « contactez OranPromo », aucun bouton", statut => {
    render(<PositionEspace statut={statut} latitude={35.7303} longitude={-0.5784} />);
    expect(screen.getByText("Pour déplacer votre boutique sur la carte, contactez OranPromo.")).toBeInTheDocument();
    expect(screen.getByText("35,730300 · −0,578400")).toBeInTheDocument();
    expect(screen.getByTestId("carte")).toHaveAttribute("data-deplacable", "false");
    expect(screen.queryByRole("button", { name: /Enregistrer|Je suis dans la boutique|Retirer/ })).toBeNull();
  });
});

const boutique: Tables<"boutiques"> = { id: "b1", nom: "Boutique Nour", quartier: "Akid Lotfi", statut: "validee", slug: "boutique-nour", adresse: "Oran", whatsapp: "+213555123456", latitude: 35.7303, longitude: -0.5784, horaires: null, instagram: null, facebook: null, cree_le: "2026-10-09T00:00:00Z", bons_acceptes: true, ville: "oran" };
describe("US-24.2 : /admin/boutiques, bouton « Position »", () => {
  it("admin : affiche la position, ouvre le bloc et enregistre même une boutique validée", async () => {
    render(<BoutiquesAdministration boutiques={[boutique]} role="admin" />);
    expect(screen.getByText("Position : 35,730300 · −0,578400")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Position" }));
    fireEvent.click(screen.getByRole("button", { name: "Déplacer l’épingle" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la position" }));
    await waitFor(() => expect(modifierPositionBoutique).toHaveBeenCalledWith("b1", 35.7034, -0.6436));
  });
  it("ambassadeur : pas de bouton « Position » (il place la boutique à la création)", () => {
    render(<BoutiquesAdministration boutiques={[{ ...boutique, latitude: null, longitude: null }]} role="ambassadeur" />);
    expect(screen.getByText("Sans position sur la carte")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Position" })).toBeNull();
  });
});
