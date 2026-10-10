import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import CodeTelephone from "./CodeTelephone";

const m = vi.hoisted(() => ({ envoyerCodeConnexion: vi.fn(), verifierCodeConnexion: vi.fn(), envoyerCodeVerification: vi.fn(), verifierCodeVerification: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/compte/connexion/actions", () => ({ envoyerCodeConnexion: m.envoyerCodeConnexion, verifierCodeConnexion: m.verifierCodeConnexion }));
vi.mock("@/app/compte/actions", () => ({ envoyerCodeVerification: m.envoyerCodeVerification, verifierCodeVerification: m.verifierCodeVerification }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace, refresh: m.refresh }) }));
// Contrôle anti-robot simulé : un bouton qui fournit un jeton.
vi.mock("./Turnstile", () => ({ default: ({ onJeton, reinitialiser }: { onJeton: (j: string | null) => void; reinitialiser: number }) => <button type="button" data-reinit={reinitialiser} onClick={() => onJeton("jeton-captcha")}>Je ne suis pas un robot</button> }));

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.clearAllMocks();
  m.envoyerCodeConnexion.mockResolvedValue({ succes: true, message: "Code envoyé sur WhatsApp.", numero: "+213555123456" });
  m.verifierCodeConnexion.mockResolvedValue({ succes: true, message: "Vous êtes connecté.", suite: "/panier" });
  m.envoyerCodeVerification.mockResolvedValue({ succes: true, message: "Code envoyé sur WhatsApp.", numero: "+213661234567" });
  m.verifierCodeVerification.mockResolvedValue({ succes: true, message: "Numéro vérifié." });
});

const saisir = (numero: string) => fireEvent.change(screen.getByLabelText("Numéro de mobile"), { target: { value: numero } });
const accepter = () => fireEvent.click(screen.getByRole("checkbox", { name: /J’accepte les conditions d’utilisation/ }));

describe("connexion par numéro (US-21.2)", () => {
  it("refuse tout de suite un numéro non algérien", () => {
    render(<CodeTelephone usage="connexion" suite="/panier" />);
    saisir("+33 6 12 34 56 78");
    fireEvent.click(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" }));
    expect(screen.getByRole("alert")).toHaveTextContent("mobile algérien");
    expect(m.envoyerCodeConnexion).not.toHaveBeenCalled();
  });
  it("WhatsApp par défaut, puis code à 6 chiffres et retour à la page demandée", async () => {
    render(<CodeTelephone usage="connexion" suite="/panier" />);
    saisir("0555 12 34 56");
    accepter();
    fireEvent.click(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" }));
    await screen.findByLabelText("Code à 6 chiffres");
    expect(m.envoyerCodeConnexion).toHaveBeenCalledWith("+213555123456", null);
    expect(screen.getByRole("status")).toHaveTextContent("Code envoyé sur WhatsApp");
    fireEvent.change(screen.getByLabelText("Code à 6 chiffres"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider le code" }));
    expect(screen.getByRole("alert")).toHaveTextContent("6 chiffres");
    fireEvent.change(screen.getByLabelText("Code à 6 chiffres"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider le code" }));
    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/panier"));
    expect(m.verifierCodeConnexion).toHaveBeenCalledWith("+213555123456", "123456", "/panier", true);
  });
  it("WhatsApp uniquement : pas de bouton SMS", () => {
    render(<CodeTelephone usage="connexion" />);
    expect(screen.queryByRole("button", { name: /SMS/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/SMS/i)).not.toBeInTheDocument();
  });
  it("affiche le refus du serveur (limite d’envoi) et le code faux", async () => {
    m.envoyerCodeConnexion.mockResolvedValueOnce({ succes: false, message: "Attendez une minute avant de demander un nouveau code." });
    render(<CodeTelephone usage="connexion" />);
    saisir("0555123456");
    accepter();
    fireEvent.click(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Attendez une minute");
    fireEvent.click(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" }));
    await screen.findByLabelText("Code à 6 chiffres");
    m.verifierCodeConnexion.mockResolvedValueOnce({ succes: false, message: "Code incorrect ou expiré." });
    fireEvent.change(screen.getByLabelText("Code à 6 chiffres"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider le code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect ou expiré.");
    expect(m.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Changer de numéro ou recevoir un nouveau code" }));
    expect(screen.getByLabelText("Numéro de mobile")).toHaveValue("0555123456");
  });
  it("avec Turnstile : boutons désactivés jusqu’au contrôle, jeton transmis puis contrôle renouvelé", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "cle-de-site");
    render(<CodeTelephone usage="connexion" />);
    saisir("0555123456");
    accepter();
    expect(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Je ne suis pas un robot" }));
    fireEvent.click(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" }));
    await screen.findByLabelText("Code à 6 chiffres");
    expect(m.envoyerCodeConnexion).toHaveBeenCalledWith("+213555123456", "jeton-captcha");
    fireEvent.click(screen.getByRole("button", { name: "Changer de numéro ou recevoir un nouveau code" }));
    expect(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Je ne suis pas un robot" })).toHaveAttribute("data-reinit", "1");
  });
});

describe("US-34.2 : case des conditions à l’inscription", () => {
  it("non cochée d’office ; sans elle, pas d’envoi du code ; liens vers les deux textes et mention provisoire", () => {
    render(<CodeTelephone usage="connexion" suite="/panier" />);
    const caseConditions = screen.getByRole("checkbox", { name: /J’accepte les conditions d’utilisation et la politique de confidentialité, y compris l’utilisation de prestataires situés hors d’Algérie/ });
    expect(caseConditions).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Conditions d’utilisation" })).toHaveAttribute("href", "/conditions");
    expect(screen.getByRole("link", { name: "Politique de confidentialité" })).toHaveAttribute("href", "/confidentialite");
    expect(screen.getByText("Version provisoire, en cours de relecture juridique.")).toBeInTheDocument();
    saisir("0555123456");
    fireEvent.click(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Cochez la case pour créer votre compte.");
    expect(caseConditions).toHaveAttribute("aria-invalid", "true");
    expect(m.envoyerCodeConnexion).not.toHaveBeenCalled();
    fireEvent.click(caseConditions);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("pas de case pour vérifier le numéro d’un compte déjà connecté", () => {
    render(<CodeTelephone usage="verification" numeroInitial="+213661234567" />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("vérifier le numéro d’un compte connecté (US-21.2)", () => {
  it("préremplit le numéro, n’affiche pas de captcha et prévient quand c’est vérifié", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "cle-de-site");
    const onVerifie = vi.fn();
    render(<CodeTelephone usage="verification" numeroInitial="+213661234567" onVerifie={onVerifie} />);
    expect(screen.getByLabelText("Numéro de mobile")).toHaveValue("0661 23 45 67");
    expect(screen.queryByRole("button", { name: "Je ne suis pas un robot" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /SMS/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recevoir le code sur WhatsApp" }));
    await screen.findByLabelText("Code à 6 chiffres");
    expect(m.envoyerCodeVerification).toHaveBeenCalledWith("+213661234567");
    fireEvent.change(screen.getByLabelText("Code à 6 chiffres"), { target: { value: "654 321" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider le code" }));
    await waitFor(() => expect(onVerifie).toHaveBeenCalled());
    expect(m.verifierCodeVerification).toHaveBeenCalledWith("+213661234567", "654321");
    expect(m.refresh).toHaveBeenCalled();
  });
});

describe("US-23 : erreurs en arabe", () => {
  it("numéro invalide : message en arabe, aucun envoi", async () => {
    const { default: FournisseurTextes } = await import("./FournisseurTextes");
    const { textesDe } = await import("@/lib/textes");
    const t = textesDe("ar").code;
    render(<FournisseurTextes langue="ar" textes={textesDe("ar")}><CodeTelephone usage="connexion" suite="/panier" /></FournisseurTextes>);
    fireEvent.change(screen.getByLabelText(t.numero), { target: { value: "0123" } });
    fireEvent.click(screen.getByRole("button", { name: t.recevoir }));
    expect(await screen.findByRole("alert")).toHaveTextContent("بورطابل جزائري");
    expect(m.envoyerCodeConnexion).not.toHaveBeenCalled();
  });
});
