import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FournisseurTextes from "./FournisseurTextes";
import ChoixParrain from "./ChoixParrain";
import MonParrainage from "./MonParrainage";
import MesBons from "./MesBons";
import BonPanier from "./BonPanier";
import MerciParrainage from "./MerciParrainage";
import ContenuParrainage, { type VueParrainage } from "./ContenuParrainage";
import BlocRetrait from "./BlocRetrait";
import { fr } from "@/lib/textes/fr";
import { ar } from "@/lib/textes/ar";
import type { MonParrainage as Donnees } from "@/lib/parrainage";
import type { BonClient } from "@/lib/bons";

const { choisirParrain, refresh } = vi.hoisted(() => ({ choisirParrain: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/compte/parrainage/actions", () => ({ choisirParrain }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { vi.clearAllMocks(); });

const ENREGISTRE = fr.parrainage.enregistre.replace(/’/g, "'");
const invitation = { code: "K7M2QX", lien: "https://oranpromo.dz/p/K7M2QX", whatsapp: "https://wa.me/?text=Je%20t'invite", qr: null };
const donnees = (extra: Partial<Donnees> = {}): Donnees => ({ actif: true, peut_parrainer: true, code: "K7M2QX", parrain_saisi: false, saisies: 0, peut_choisir: false, choix_jusqu_au: null,
  filleuls: [{ prenom: "Samir B.", valide_le: "2026-10-12T10:00:00Z", statut: "valide" }, { prenom: "Nadia M.", valide_le: "2026-10-02T10:00:00Z", statut: "en_file" }], en_attente: 1, plafond_atteint: false, ...extra });

describe("US-27.2 : « Ton parrain »", () => {
  it("champ pré-rempli avec le code du lien ; le client touche quand même « Valider » ; message identique", async () => {
    choisirParrain.mockResolvedValue({ succes: true, message: ENREGISTRE });
    render(<ChoixParrain initial="K7M2QX" parrainSaisi={false} saisies={0} />);
    const champ = screen.getByLabelText(fr.parrainage.champ);
    expect(champ).toHaveValue("K7M2QX");
    expect(choisirParrain).not.toHaveBeenCalled();
    expect(screen.getByText(fr.parrainage.rappel)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(ENREGISTRE));
    expect(choisirParrain).toHaveBeenCalledWith("K7M2QX");
    expect(screen.getByText("Parrain enregistré")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
  it("parrain déjà saisi : « Parrain enregistré » et « Modifier » tant qu'il reste des modifications", () => {
    const { unmount } = render(<ChoixParrain parrainSaisi saisies={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    expect(screen.getByLabelText(fr.parrainage.champ)).toHaveValue("");
    expect(screen.getByText("Tu peux encore le modifier 2 fois, avant ta première commande.")).toBeInTheDocument();
    unmount();
    render(<ChoixParrain parrainSaisi saisies={3} />);
    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
  });
  it("erreur sur sa propre saisie affichée ; bouton désactivé sans saisie", async () => {
    choisirParrain.mockResolvedValue({ succes: false, message: "C'est ton propre numéro : choisis le numéro d'un ami." });
    render(<ChoixParrain parrainSaisi={false} saisies={0} />);
    expect(screen.getByRole("button", { name: "Valider" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(fr.parrainage.champ), { target: { value: "0661234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("C'est ton propre numéro"));
    expect(screen.queryByText("Parrain enregistré")).toBeNull();
  });
});

describe("US-27.3 : « Mon parrainage » et « Mes bons »", () => {
  it("compteurs, filleuls récompensés (prénom + initiale, jamais de numéro), lien et partage", () => {
    render(<MonParrainage parrainage={donnees()} invitation={invitation} />);
    const bloc = screen.getByRole("region", { name: "Mon parrainage" });
    expect(bloc).toHaveTextContent("2amis ont fait leur premier retrait");
    expect(bloc).toHaveTextContent("1en attente de leur premier retrait");
    expect(within(bloc).getByText("Samir B. · 12 octobre")).toBeInTheDocument();
    expect(within(bloc).getByText("bon en attente (budget)")).toBeInTheDocument();
    expect(bloc.textContent).not.toMatch(/\+213|0\d{9}/);
    expect(within(bloc).getByRole("link", { name: "Partager sur WhatsApp" })).toHaveAttribute("href", invitation.whatsapp);
    expect(within(bloc).getByText("K7M2QX")).toBeInTheDocument();
  });
  it("un seul filleul : singulier ; plafond du mois signalé ; aucun filleul", () => {
    const { unmount } = render(<MonParrainage parrainage={donnees({ filleuls: [donnees().filleuls[0]], en_attente: 0, plafond_atteint: true })} invitation={null} />);
    expect(screen.getByText("ami a fait son premier retrait")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Plafond du mois atteint");
    unmount();
    render(<MonParrainage parrainage={donnees({ filleuls: [], en_attente: 0 })} invitation={null} />);
    expect(screen.getByText(fr.parrainage.aucunFilleul)).toBeInTheDocument();
  });
  it("Mes bons : disponible, réservé, utilisé, en file, avec la phrase d'aide", () => {
    const bons: BonClient[] = [
      { id: "1", montant: 300, statut: "disponible", origine: "parrainage_parrain", cree_le: "2026-10-12T10:00:00Z", expire_le: "2026-12-11T10:00:00Z", utilise_le: null, commande: null, numero: null, boutique: null },
      { id: "2", montant: 300, statut: "reserve", origine: "parrainage_parrain", cree_le: "2026-10-12T10:00:00Z", expire_le: "2026-12-11T10:00:00Z", utilise_le: null, commande: "c", numero: 128, boutique: null },
      { id: "3", montant: 300, statut: "utilise", origine: "parrainage_filleul", cree_le: "2026-10-01T10:00:00Z", expire_le: "2026-11-30T10:00:00Z", utilise_le: "2026-10-12T10:00:00Z", commande: "d", numero: 12, boutique: "Maison Ilyes" },
      { id: "4", montant: 300, statut: "en_file", origine: "parrainage_parrain", cree_le: "2026-10-12T10:00:00Z", expire_le: null, utilise_le: null, commande: null, numero: null, boutique: null },
    ];
    render(<MesBons bons={bons} maintenant={new Date("2026-10-20T10:00:00Z")} />);
    expect(screen.getByText("Disponible · valable jusqu’au 11 décembre")).toBeInTheDocument();
    expect(screen.getByText("Réservé pour la commande n° 128")).toBeInTheDocument();
    expect(screen.getByText("Utilisé le 12/10 chez Maison Ilyes")).toBeInTheDocument();
    expect(screen.getByText("Ton bon arrive le 1er novembre (budget du mois atteint).")).toBeInTheDocument();
    expect(screen.getByText(/^À utiliser au panier : 300\sDA de moins, payés par BleDeal à la boutique\.$/)).toBeInTheDocument();
  });
  it("encadré « Merci ! » avec le lien WhatsApp du client", () => {
    render(<MerciParrainage whatsapp="https://wa.me/?text=x" />);
    expect(screen.getByRole("heading", { name: "Merci !" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Partager mon lien" })).toHaveAttribute("href", "https://wa.me/?text=x");
  });
});

describe("US-27.3 : page /parrainage", () => {
  const vue = (extra: Partial<VueParrainage> = {}): VueParrainage => ({ ouvert: true, invite: false, visiteur: "anonyme", invitation: null, choix: null, ...extra });
  const page = (v: VueParrainage, t = fr.parrainage) => renderToStaticMarkup(<ContenuParrainage t={t} vue={v} />);
  it("visiteur : 3 étapes, récompense, règles, « Connecte-toi pour avoir ton lien »", () => {
    const html = page(vue());
    for (const texte of ["Parraine tes amis", "Partage ton lien sur WhatsApp.", "Un bon de 300 DA chacun, à déduire en boutique.", "5 amis récompensés par mois au plus.", "Connecte-toi pour avoir ton lien"]) expect(html).toContain(texte);
    expect(html).toContain('href="/compte/connexion?suite=/compte"');
  });
  it("client avec numéro vérifié : code, lien, WhatsApp, copier", () => {
    const html = page(vue({ visiteur: "client", invitation }));
    expect(html).toContain("K7M2QX"); expect(html).toContain("oranpromo.dz/p/K7M2QX");
    expect(html).toContain(invitation.whatsapp.replace(/'/g, "&#x27;")); expect(html).toContain("Copier le lien");
  });
  it("invitation : « Un ami t'invite » ; connecté et encore libre de choisir : champ pré-rempli", () => {
    expect(page(vue({ invite: true }))).toContain("Un ami t’invite sur BleDeal");
    const html = page(vue({ invite: true, visiteur: "autre", choix: { initial: "K7M2QX", parrainSaisi: false, saisies: 0 } }));
    expect(html).toContain('value="K7M2QX"');
  });
  it("parrainage fermé : pas de lien ni de formulaire", () => {
    const html = page(vue({ ouvert: false }));
    expect(html).toContain("pas encore ouvert"); expect(html).not.toContain("Se connecter");
  });
  it("connecté sans numéro vérifié : réservé aux clients vérifiés", () => {
    expect(page(vue({ visiteur: "autre" }))).toContain(fr.parrainage.reserveClients);
  });
  it("en arabe : titre et étapes validés", () => {
    const html = page(vue(), ar.parrainage);
    expect(html).toContain("عرّض صحابك"); expect(html).toContain("ابعث الرابط نتاعك لصحابك على واتساب.");
  });
});

describe("US-27.4 : bon au panier et sur le QR code", () => {
  it("case cochée : Total, Bon parrainage −300 DA, À payer en boutique", () => {
    const changer = vi.fn();
    render(<BonPanier total={3500} utiliser onChange={changer} />);
    expect(screen.getByRole("checkbox", { name: /^Utiliser mon bon parrainage \(−300\sDA\)$/ })).toBeChecked();
    expect(screen.getByText("À payer en boutique").nextSibling).toHaveTextContent(/3\s200\sDA/);
    expect(screen.getByText("Bon parrainage").nextSibling).toHaveTextContent(/−300\sDA/);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(changer).toHaveBeenCalledWith(false);
  });
  it("case décochée : pas de montant réduit ; sous 1 000 DA : pas de case, la raison", () => {
    const { unmount } = render(<BonPanier total={3500} utiliser={false} onChange={vi.fn()} />);
    expect(screen.queryByText("À payer en boutique")).toBeNull();
    unmount();
    render(<BonPanier total={900} utiliser onChange={vi.fn()} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("Ton bon s’utilise dès 1 000 DA d’achat.")).toBeInTheDocument();
  });
  it("QR code (client et proche) : « Bon parrainage −300 DA » et « À payer en espèces : 3 200 DA »", () => {
    render(<BlocRetrait qr="data:image/svg+xml,x" code="048193" numero={12} total={3500} remise={300} />);
    expect(screen.getByText("Bon parrainage").nextSibling).toHaveTextContent(/−300\sDA/);
    expect(screen.getByText("À payer en espèces").nextSibling).toHaveTextContent(/3\s200\sDA/);
  });
  it("en arabe : case et total (textes 17 et 18)", () => {
    render(<FournisseurTextes langue="ar" textes={ar}><BonPanier total={3500} utiliser onChange={vi.fn()} /></FournisseurTextes>);
    expect(screen.getByRole("checkbox", { name: /^خدم بالبون نتاعي \(−\u2066?300\u2069?\sدج\)$/ })).toBeChecked();
    expect(screen.getByText("تخلّص في الحانوت")).toBeInTheDocument();
  });
});

describe("US-33.2 : bon de bienvenue dans « Mes bons » et au panier", () => {
  const bienvenue: BonClient = { id: "b", montant: 300, statut: "disponible", origine: "bienvenue", cree_le: "2026-10-10T10:00:00Z", expire_le: "2026-11-09T10:00:00Z",
    utilise_le: null, commande: null, numero: null, boutique: null, minimum_achat: 2000, univers: null, villes: [], nom_fr: "Bienvenue", nom_ar: "مرحبا" };
  it("Mes bons : « Bon de bienvenue · 300 DA dès 2 000 DA d'achat · jusqu'au 9/11 » (texte n° 2)", () => {
    render(<MesBons bons={[bienvenue, { ...bienvenue, id: "r", statut: "reserve", commande: "c", numero: 7 }]} maintenant={new Date("2026-10-20T10:00:00Z")} />);
    expect(screen.getAllByText("Bon de bienvenue")).toHaveLength(2);
    expect(screen.getByText(/^300\sDA dès 2\s000\sDA d’achat · jusqu’au 9\/11$/)).toBeInTheDocument();
    expect(screen.getByText("Réservé pour la commande n° 7")).toBeInTheDocument();
  });
  it("Mes bons en arabe : « بون مرحبا »", () => {
    render(<FournisseurTextes langue="ar" textes={ar}><MesBons bons={[bienvenue]} maintenant={new Date("2026-10-20T10:00:00Z")} /></FournisseurTextes>);
    expect(screen.getByText("بون مرحبا")).toBeInTheDocument();
    expect(screen.getByText(/كي تشري .* ولا كثر · حتى 9\/11/)).toBeInTheDocument();
  });
  it("panier : case « Utiliser mon bon de bienvenue (−300 DA) », ligne « Bon de bienvenue », règle d'annulation des bons de programme", () => {
    render(<BonPanier total={2500} utiliser onChange={vi.fn()} bon={bienvenue} applicable />);
    expect(screen.getByRole("checkbox", { name: /^Utiliser mon bon de bienvenue \(−300\sDA\)$/ })).toBeChecked();
    expect(screen.getByText("Bon de bienvenue")).toBeInTheDocument();
    expect(screen.getByText("À payer en boutique").nextSibling).toHaveTextContent(/2\s200\sDA/);
    expect(screen.getByText(fr.parrainage.noteBonProgramme)).toBeInTheDocument();
  });
  it("panier sous le minimum : « Bon de bienvenue · Dès 2 000 DA d'achat », pas de case", () => {
    render(<BonPanier total={1500} utiliser onChange={vi.fn()} bon={bienvenue} applicable={false} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/Bon de bienvenue · Dès 2\s000\sDA d’achat/)).toBeInTheDocument();
  });
});
