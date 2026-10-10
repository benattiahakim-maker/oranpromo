// US-34.1 : pages juridiques publiques (version provisoire) et pied de page, à 375 px, en français puis en arabe.
import { expect, test } from "@playwright/test";

test("pages juridiques : pied de page → conditions, commerçants, confidentialité ; bandeau provisoire ; arabe", async ({ page }) => {
  await page.goto("/villes");
  const pied = page.getByRole("navigation", { name: "Informations juridiques" });
  await pied.getByRole("link", { name: "Conditions", exact: true }).click();
  await expect(page).toHaveURL(/\/conditions$/);
  await expect(page.getByRole("heading", { level: 1, name: "Conditions d’utilisation" })).toBeVisible();
  await expect(page.getByText("Version provisoire, en cours de relecture juridique.")).toBeVisible();
  await expect(page.getByText("Version du 10/10/2026")).toBeVisible();
  await expect(page.getByText("BleDeal ne vend rien.").first()).toBeVisible();

  await pied.getByRole("link", { name: "Commerçants" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Conditions commerçants" })).toBeVisible();
  await pied.getByRole("link", { name: "Confidentialité" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Politique de confidentialité" })).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible();
  // Rien ne dépasse à 375 px (tableaux dans un bloc qui défile).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.getByRole("form", { name: "Langue" }).getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1, name: "سياسة الخصوصية" })).toBeVisible();
  await expect(page.getByText("نسخة مؤقتة، راهي في المراجعة القانونية.")).toBeVisible();
  await expect(page.getByText("الترجمة بالعربية تاع هاد النص جاية قريب.", { exact: false })).toBeVisible();
  await page.getByRole("form", { name: "اللغة" }).getByRole("button", { name: "Français" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
