import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import Turnstile from "./Turnstile";

// next/script simulé : le script est « chargé » tout de suite.
vi.mock("next/script", () => ({ default: function Script({ onLoad, src }: { onLoad?: () => void; src: string }) { useEffect(() => { onLoad?.(); }, [onLoad]); return <span data-src={src} />; } }));
afterEach(() => { cleanup(); delete window.turnstile; });

describe("Turnstile (US-21)", () => {
  it("affiche le contrôle avec la clé de site, transmet le jeton et l’efface quand il expire", () => {
    let options: { sitekey: string; language?: string; callback: (j: string) => void; "expired-callback": () => void; "error-callback": () => void } | undefined;
    window.turnstile = { render: vi.fn((_e, o) => { options = o; return "w1"; }), reset: vi.fn(), remove: vi.fn() };
    const onJeton = vi.fn();
    const { container, rerender, unmount } = render(<Turnstile cle="cle-de-site" onJeton={onJeton} />);
    expect(container.querySelector("[data-src]")?.getAttribute("data-src")).toBe("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
    expect(window.turnstile.render).toHaveBeenCalledTimes(1);
    expect(options?.sitekey).toBe("cle-de-site");
    expect(options?.language).toBe("fr");
    options?.callback("jeton");
    expect(onJeton).toHaveBeenLastCalledWith("jeton");
    options?.["expired-callback"]();
    expect(onJeton).toHaveBeenLastCalledWith(null);
    options?.["error-callback"]();
    expect(onJeton).toHaveBeenLastCalledWith(null);
    rerender(<Turnstile cle="cle-de-site" onJeton={onJeton} reinitialiser={1} />);
    expect(window.turnstile.reset).toHaveBeenCalledWith("w1");
    unmount();
    expect(window.turnstile?.remove).toHaveBeenCalledWith("w1");
  });
});
