import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const { langue } = vi.hoisted(() => ({ langue: { valeur: "fr" as "fr" | "ar" } }));
vi.mock("next/font/google", () => {
  const police = (nom: string) => () => ({ variable: `police-${nom}` });
  return { Bodoni_Moda: police("bodoni"), Jost: police("jost"), Tajawal: police("tajawal"), Noto_Naskh_Arabic: police("naskh") };
});
vi.mock("@/lib/langue-serveur", () => ({ getLangue: async () => langue.valeur }));
import RootLayout from "./layout";
import { useTextes } from "@/components/FournisseurTextes";

function Sonde() { return <p>{useTextes().erreur.titre}</p>; }

describe("US-23 : mise en page selon la langue", () => {
  it.each([["fr", "ltr", "Une erreur est survenue"], ["ar", "rtl", "كاين مشكل"]] as const)("langue %s : <html lang dir>, textes de la langue, polices arabes chargées", async (code, sens, texte) => {
    langue.valeur = code;
    const html = renderToStaticMarkup(await RootLayout({ children: <Sonde />, params: Promise.resolve({}) } as unknown as LayoutProps<"/">));
    expect(html).toContain(`<html lang="${code}" dir="${sens}"`);
    expect(html).toContain("police-tajawal"); expect(html).toContain("police-naskh");
    expect(html).toContain(texte);
  });
});
