import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ConnexionEmail from "./ConnexionEmail";

const { envoyerLienConnexion } = vi.hoisted(() => ({ envoyerLienConnexion: vi.fn() }));
vi.mock("@/lib/connexion", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/connexion")>()), envoyerLienConnexion }));
vi.mock("./Turnstile", () => ({ default: ({ onJeton }: { onJeton: (j: string | null) => void }) => <button type="button" onClick={() => onJeton("jeton-captcha")}>Je ne suis pas un robot</button> }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
beforeEach(() => { vi.clearAllMocks(); envoyerLienConnexion.mockResolvedValue(undefined); });

describe("lien de connexion par e-mail (US-09, US-21)", () => {
  it("sans clé Turnstile : comme avant, pas de contrôle", async () => {
    render(<ConnexionEmail suite="/panier" />);
    expect(screen.queryByRole("button", { name: "Je ne suis pas un robot" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "client@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Recevoir mon lien de connexion" }));
    await waitFor(() => expect(envoyerLienConnexion).toHaveBeenCalledWith("client@example.com", window.location.origin, "/panier", null));
  });
  it("avec la clé Turnstile : bouton désactivé jusqu’au contrôle, puis jeton transmis", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "cle-de-site");
    render(<ConnexionEmail />);
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "boutique@example.com" } });
    expect(screen.getByRole("button", { name: "Recevoir mon lien de connexion" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Je ne suis pas un robot" }));
    fireEvent.click(screen.getByRole("button", { name: "Recevoir mon lien de connexion" }));
    await waitFor(() => expect(envoyerLienConnexion).toHaveBeenCalledWith("boutique@example.com", window.location.origin, "/espace", "jeton-captcha"));
    expect(await screen.findByRole("status")).toHaveTextContent("Un lien de connexion vous a été envoyé");
    expect(screen.getByRole("button", { name: "Recevoir mon lien de connexion" })).toBeDisabled();
  });
});
