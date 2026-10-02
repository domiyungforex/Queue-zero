import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390, 320]) {
  test(`public screens remain usable without sample data at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/pricing", "/how-it-works"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/A01[3-6]|Interactive product demo|Sample data/)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}

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

test('legacy demo URLs redirect to the real workspace without rendering fixtures', async ({ request }) => {
  const response = await request.get('/demo?view=queue', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location, 'http://localhost').pathname).toBe('/dashboard');
  expect(await response.text()).not.toContain('Acacia Care');
});
