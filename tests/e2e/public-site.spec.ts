import { expect, test } from "@playwright/test";
const pages = ["/", "/how-it-works", "/pricing", "/solutions/education", "/contact", "/privacy"];
for (const width of [360, 768]) {
  test(`public pages have real metadata, one heading and no overflow at ${width}px`, async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    if (!baseURL) throw new Error("E2E_BASE_URL is required for canonical URL checks");
    await page.setViewportSize({ width, height: 800 });
    const titles = new Set<string>();
    for (const path of pages) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main h1")).toHaveCount(1);
      const title = await page.title();
      expect(title).toContain("TuRnMaRk"); titles.add(title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S.{25}/);
      const expectedCanonical = path === "/" ? new URL(baseURL).origin : new URL(path, baseURL).href;
      expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(expectedCanonical);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator('img:not([alt])').count()).toBe(0);
      await expect(page.getByRole("link", { name: "TuRnMaRk home" }).first()).toHaveAttribute("href", "/");
    }
    expect(titles.size).toBe(pages.length);
  });
}
test("mobile navigation, FAQs and custom missing-page recovery", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  const navigation = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  await toggle.click();
  await expect(navigation.getByRole("link", { name: "Contact" })).toBeVisible();
  await navigation.getByRole("link", { name: "Product", exact: true }).click();
  await expect(navigation).not.toBeVisible();
  await expect(page).toHaveURL(/#product$/);
  await toggle.click();
  await navigation.getByRole("link", { name: "Contact" }).focus();
  await page.keyboard.press("Escape");
  await expect(navigation).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await expect(page.locator("#questions details")).toHaveCount(5);
  await page.goto("/not-a-real-turnmark-page");
  await expect(page.getByRole("heading", { name: "This page stepped out." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
});
test("search assets and social card are available", async ({ request }) => {
  for (const path of ["/robots.txt", "/sitemap.xml", "/llm.txt", "/llms.txt", "/icon.svg", "/opengraph-image"]) {
    const response = await request.get(path); expect(response.ok()).toBe(true);
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toMatch(/dashboard|attendance|token=/);
});
