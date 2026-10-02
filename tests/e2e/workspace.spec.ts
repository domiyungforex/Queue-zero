import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390, 320]) {
  test(`workspace screens remain usable at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ["overview", "queue", "analytics", "locations", "billing", "settings"]) {
      await page.goto(`/demo?view=${view}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Interactive product demo.", { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}

test("staff console preserves one active customer and supports the operating cycle", async ({ page }) => {
  await page.goto("/demo?view=queue");
  const next = page.getByRole("button", { name: "Call next", exact: true });
  await next.click();
  await expect(page.getByRole("button", { name: "Complete service" })).toBeVisible();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Recall", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("recall alert");
  await page.getByRole("button", { name: "Complete service" }).click();
  await next.click();
  await expect(page.locator(".serving-card h2")).toHaveText("David");
  await page.getByRole("button", { name: "No-show", exact: true }).click();
  await page.getByRole("button", { name: "Keep ticket" }).click();
  await expect(page.locator(".serving-card h2")).toHaveText("David");
  await page.getByRole("button", { name: "No-show", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(next).toBeEnabled();
  await page.getByRole("button", { name: "Pause queue" }).click();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Open queue" }).click();
  await expect(next).toBeEnabled();
});

test("public navigation and unknown ticket handling", async ({ page }) => {
  for (const route of ["/", "/pricing", "/how-it-works", "/sign-in", "/sign-up"]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/ticket/not-a-token");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/ticket/not-a-token");
  const manifest = await page.goto("/manifest.webmanifest");
  expect(manifest?.ok()).toBe(true);
  expect((await manifest!.json()).display).toBe("standalone");
});
